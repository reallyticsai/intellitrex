# Model configuration management: implementation plan

## Objective

Allow the operator to add, save, test, edit, activate, and delete chatbot model configurations through the app. Switching between OpenAI and OpenRouter must require configuration changes rather than changes to chatbot code.

SQLite persists configurations. The chosen configuration applies to the shared AI consultant. This document records the implementation plan; see [setup and operations](./model-settings-setup.md) for the delivered feature and commands.

## Scope

- One application table: `model_configurations`.
- A Model Settings section in the existing admin area.
- Backend endpoints for configuration management and connection testing.
- A shared client for compatible chat-completions endpoints.
- Integration with the existing `/api/chat` route.
- Encryption of saved provider credentials.
- A narrow server-side operator access gate for this feature.

Out of scope: user registration, Google OAuth, user/session tables, billing, moving chat history into SQLite, portfolio changes, forecasting changes, user-specific model selection, automatic provider fallback, streaming, and arbitrary uploaded model files.

“Plug in a model” means configure an accessible model hosted behind a supported chat-completions API. It does not mean run model weights inside Next.js. This version targets OpenAI and OpenRouter; other endpoints must satisfy the same contract and are not automatically guaranteed compatible.

## Current structure

`src/app/consultancy/page.tsx` sends message, history, and advisor mode to `/api/chat`. `src/app/api/chat/route.ts` builds the mode prompt, reads `OPENAI_API_KEY`, calls a fixed OpenAI URL with `gpt-4o-mini`, and returns `{ response }`.

The app has Next.js backend routes but no database. The current admin flag is controlled in browser storage and cannot authorize access to saved provider keys. Forecast model selection is separate and remains untouched.

## Implementation sequence

### 1. Inspect runtime and framework requirements

1. Check the installed Node version, package manager, deployment target, and persistent storage location.
2. Restore dependencies using the existing lockfile if needed.
3. Read the relevant Next.js guides in `node_modules/next/dist/docs/` before writing route or UI code, particularly route handlers, cookies, caching, and server/client boundaries.
4. Capture baseline build and lint results so existing failures are distinguished from new ones.

The local Next.js documentation directory was absent when this plan was written. Dependencies were restored and the relevant bundled guides were read before implementation.

### 2. Add SQLite persistence

Use a small SQLite repository module with parameterized SQL. The checked Node 24 runtime supports the built-in `node:sqlite` driver, which was selected instead of a native dependency. An ORM is unnecessary for one table.

Run database-backed routes in the Node.js runtime. Use a configured absolute database path outside public assets, enable WAL and a bounded busy timeout, and keep transactions short. Use one process-level connection where supported, including development hot-reload handling. Do not hold transactions open during provider requests.

Initialize the schema through a versioned migration using SQLite `PRAGMA user_version`, avoiding an additional application table. Initialization must be safe to run repeatedly and fail clearly if the file is unwritable or the schema version is unsupported.

Proposed schema:

```sql
CREATE TABLE model_configurations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 100),
  base_url TEXT NOT NULL,
  model_id TEXT NOT NULL CHECK (length(trim(model_id)) BETWEEN 1 AND 200),
  api_key_encrypted TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 0 CHECK (is_active IN (0, 1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE UNIQUE INDEX one_active_model_configuration
ON model_configurations(is_active)
WHERE is_active = 1;
```

Generate IDs on the server and store UTC timestamps. Duplicate display names and multiple configurations for the same model are permitted; IDs determine identity.

The unique partial index guarantees at most one active configuration, including concurrent requests.

### 3. Encrypt saved API keys

Accept the provider API key through a password input over the protected settings API, encrypt it before insertion, and decrypt only on the server when making a provider request.

Use authenticated encryption such as AES-256-GCM with a random nonce for each encryption. Store a versioned envelope containing nonce, ciphertext, and authentication tag in `api_key_encrypted`. Use a dedicated, random encryption key supplied through server configuration; do not derive it from the operator password or store it in SQLite.

Ordinary configuration responses must omit both plaintext and ciphertext. Return `hasApiKey: true` instead. Never send saved keys back for editing; a blank key field on edit means retain the existing key. Reject explicit null, and require a nonempty key when creating a configuration.

Do not include keys in logs, errors, browser storage, fixtures, screenshots, or committed files. Back up the database and encryption key separately. Losing the encryption key makes saved provider keys unreadable; rotation requires decrypting and re-encrypting records rather than simply replacing the environment variable.

Environment configuration remains appropriate for infrastructure secrets, not for each saved model:

```env
MODEL_CONFIG_DATABASE_PATH=/absolute/persistent/path/intellitrex.sqlite
MODEL_CONFIG_ENCRYPTION_KEY=<random-32-byte-key-in-documented-encoding>
MODEL_SETTINGS_ADMIN_PASSWORD_HASH=<operator-password-hash>
MODEL_SETTINGS_SESSION_SECRET=<independent-random-signing-secret>
```

Document how to generate these values without printing or committing real secrets.

### 4. Protect only the model settings feature

Full user authentication is not required. Add a narrow operator sign-in for Model Settings using a server-configured password hash and a signed, short-lived HttpOnly cookie. This introduces no users or sessions table.

Verify the password on the server with a standard password-hashing implementation. Use Secure cookies in HTTPS deployments, SameSite restrictions, a bounded expiry, and server-side signature verification. Check exact request origin on state-changing requests; reject missing or foreign origins for the browser management API. Keep a login attempt limit appropriate to the single-instance deployment, documenting that in-memory limits reset on restart and distributed deployment needs shared enforcement.

Every configuration endpoint, including reads and connection tests, must verify this operator session. The existing browser admin flag is not authorization. If integrating into `/admin`, show this additional server-backed unlock only for Model Settings and leave the existing user management behavior unchanged.

Operator sign-out clears this cookie. A stateless cookie does not provide per-session revocation; short expiry and rotating the signing secret provide the initial bounded solution.

### 5. Define backend contracts

Suggested routes:

| Method | Route | Behavior |
| --- | --- | --- |
| POST | `/api/admin/model-settings/login` | Verify operator password and issue cookie. |
| DELETE | `/api/admin/model-settings/login` | Clear operator cookie. |
| GET | `/api/admin/model-settings/session` | Report whether the operator session is valid. |
| GET | `/api/admin/model-configurations` | Return saved configurations with active status and no key material. |
| POST | `/api/admin/model-configurations` | Validate and save a new inactive configuration. |
| PATCH | `/api/admin/model-configurations/[id]` | Update name, endpoint, model, or an explicitly supplied replacement key. |
| POST | `/api/admin/model-configurations/[id]/test` | Test the saved configuration without changing active state. |
| POST | `/api/admin/model-configurations/[id]/activate` | Atomically replace the active configuration. |
| DELETE | `/api/admin/model-configurations/[id]` | Delete an inactive configuration. |

Use explicit request schemas, bounded strings/body sizes, and reject unexpected fields. Return consistent errors such as `{ error: { code, message } }`. Use 400 for invalid input, 401 for no valid operator session, 404 for a missing configuration, 409 for an active-delete conflict, and suitable 502/504 responses for provider failure/timeout. Do not expose raw provider error bodies or stack traces.

Disable caching of session, configuration, and credential-dependent responses. The existing chat success contract stays `{ response: string }`.

### 6. Build the compatible provider client

Accept a decrypted configuration plus the existing system prompt and chat messages. Append `/chat/completions` to a normalized API root without duplicating path segments.

Example saved roots:

- OpenAI: `https://api.openai.com/v1`
- OpenRouter: `https://openrouter.ai/api/v1`

Use Bearer authentication, JSON messages, the saved model ID, non-streaming responses, and a bounded output budget. For this iteration, select model IDs supporting this contract; different model parameters or API families require later compatibility work. Omit optional generation parameters unless verified compatible, rather than forcing the existing temperature setting onto every model.

Validate HTTP status and response shape, extract nonempty assistant text, and translate failures into readable messages. Set a finite timeout with abort handling, bound the response size, and avoid automatic retries or provider fallback that could duplicate billed requests or change the operator’s chosen model.

A connection test sends a minimal fixed prompt with a small output budget. Explain in the UI that tests make an actual provider call and may incur charges. Tests do not use user chat history, alter configuration state, or guarantee later availability.

For the first release, allow the exact HTTPS API roots for OpenAI and OpenRouter. This makes those providers work with configuration alone while preventing arbitrary server-side requests. Reject URL credentials, query strings, fragments, and unexpected ports; disable redirects so credentials cannot be forwarded elsewhere. A future custom-host option needs explicit server-controlled host approval and private-network protections before it is enabled.

### 7. Define lifecycle rules

- **Create:** Save inactive; adding a model never replaces another record or changes the active selection.
- **Test:** Report success/failure for that configuration only; activation is a separate action.
- **Activate:** In one immediate transaction, verify the target exists, deactivate the current row, and activate the target. Roll back completely on failure.
- **Edit:** Preserve the key when omitted. Name-only edits may retain active status; changing endpoint, model, or key deactivates that configuration in the same transaction, with a clear UI warning before saving. The operator tests and activates it again explicitly.
- **Delete inactive:** Confirm the named configuration in the UI, then remove it without affecting the active configuration.
- **Delete active:** Reject with 409 and instruct the operator to activate a replacement first. No silent fallback or automatic activation of another record.
- **No active configuration:** The chatbot returns an explicit service-unconfigured error; settings remain usable to create and activate a model.

Take a complete configuration snapshot at the start of a chat request. Activation or editing affects subsequent requests; an already-running provider call finishes with its captured configuration.

### 8. Integrate the existing chatbot

Keep advisor prompts and current history behavior. Replace the hardcoded endpoint, model, and credential lookup with a server-side active-configuration lookup and the shared client.

Validate incoming chat message, mode, and history, including accepted roles and size limits. Do not allow callers to inject provider credentials or override the active configuration. Provider or database failures must not appear as successful advisor replies.

Update the consultancy UI only as needed to display the new error contract without counting failed requests as completed chatbot responses or saving infrastructure errors as assistant messages.

Do not silently fall back to `OPENAI_API_KEY` if the database is unconfigured. To preserve an existing OpenAI setup, provide an explicit one-time server-side import command that encrypts that key into a new configuration and asks the operator to activate it through settings. The command must be repeat-safe and never expose the key.

This work does not make existing public chatbot usage limits trustworthy; it protects model management only. The already-existing chat API’s public exposure and server-side quotas remain a separately identified limitation.

### 9. Build Model Settings UI

Add a focused section in `/admin`, with its own server-verified access state. Provide:

- A saved configuration list showing name, provider root, model ID, active badge, and key-present status.
- An Add Configuration form with name, API root/provider preset, model ID, and password-style API key input.
- An Edit form that never prepopulates the saved API key.
- Test Connection, Activate, and Delete actions per configuration.
- A visible active-model summary and an empty state with an Add action.
- Loading, saved, error, expired-session, testing, and active-delete conflict states.
- Keyboard-accessible labels/dialogs and usable mobile/light/dark layouts.

Disable duplicate submissions, refresh from the server after mutations, and preserve nonsecret form input on errors. Clear entered keys on success, cancellation, and session expiry. A failed test never removes an entry. Display a warning before an active configuration’s connection details are edited because saving deactivates it.

Do not call the database or decrypt secrets in client components. Do not treat browser storage as the source of truth for model settings.

### 10. Verify end to end

Use a temporary database and mocked provider responses for automated checks; avoid billable calls in the test suite.

Required meaningful checks:

1. Adding two configurations retains both after closing and reopening the database.
2. Editing preserves an omitted key; replacing it creates valid new encrypted data.
3. Database rows contain no plaintext key, and configuration APIs disclose no key material.
4. Encryption detects tampering and fails cleanly with a wrong key.
5. Concurrent activation cannot produce two active records, and failure leaves the prior selection intact.
6. Active deletion is rejected; inactive deletion leaves the active row unchanged.
7. Editing active connection details deactivates it as documented.
8. Unauthenticated and foreign-origin requests cannot manage configurations or trigger tests.
9. Invalid roots, redirects, malformed payloads, unavailable models, authentication failures, rate limits, and timeouts produce controlled errors.
10. `/api/chat` uses the saved model/root/key and preserves advisor mode/history behavior.
11. Failed chat requests do not consume the client’s response count or create misleading assistant replies.
12. New configurations are inactive; empty database and no-active states are usable.

Manually verify add, test, activate, edit, delete, sign-out, expiry, restart persistence, and responsive layouts. With operator-provided credentials, make one explicit live test and chat request against each supported provider; record which checks were actually completed and which were unavailable.

Run project build, type checks, relevant tests, and lint. Report baseline failures honestly rather than changing unrelated files to make checks pass.

## Proposed file organization

```text
src/lib/server/database.ts
src/lib/server/model-configurations.ts
src/lib/server/model-configuration-validation.ts
src/lib/server/credential-encryption.ts
src/lib/server/model-settings-auth.ts
src/lib/server/chat-completions-client.ts
src/app/api/admin/model-settings/...
src/app/api/admin/model-configurations/...
src/components/admin/model-settings.tsx
src/app/admin/page.tsx                    # settings integration
src/app/api/chat/route.ts                # active configuration integration
src/app/consultancy/page.tsx             # controlled error handling
scripts/import-existing-model.*         # explicit optional bootstrap
```

Mark database, encryption, and provider modules server-only. Adjust exact files to the installed Next.js conventions before implementation.

## Deployment and recovery

Use a single application instance with a persistent local volume for this iteration. Ephemeral/serverless disks and multiple independent replicas do not share a reliable SQLite configuration store.

Exclude the database, WAL/SHM files, real environment files, and backups from Git. Use SQLite-aware backups rather than copying an open database file without accounting for WAL. Store backups with restricted access and retain the corresponding encryption key separately.

Make migrations explicit and back up before future schema changes. Verify that a redeployment retains configurations. Document restoration of the database and matching key. If persistence cannot be provided by the chosen host, change the storage approach before deploying this feature.

## Completion criteria

The operator can save multiple configurations, switch the shared chatbot between OpenAI and OpenRouter, test connections, edit records, and delete inactive entries through the app. Saved records survive restarts. Exactly one configuration is active at most. Provider keys are encrypted at rest and never returned through the settings API. Configuration management requires server-verified operator access. Existing forecasting, user profiles, billing, and portfolio behavior remain outside this implementation.
