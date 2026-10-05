# Model Settings: setup and operations

## What is implemented

Model Settings is available at `/admin`, independently of the existing browser-based admin demo. It stores multiple connections in SQLite, encrypts provider keys, and uses one active connection for the shared AI advisor. OpenAI and OpenRouter chat-completions endpoints are supported. No user, session, billing, or portfolio tables were added.

The database adapter uses Node's built-in `node:sqlite`. Use Node 24.15 or later within the supported Node 24 release line. Node may label this API experimental. This avoids a native driver dependency; the repository boundary allows replacing the driver or engine later.

## Local setup

From the project root:

```sh
npm ci
npm run model-settings:setup
npm run dev
```

The setup command asks for an operator password twice, with hidden input. Use at least 12 characters. It generates independent encryption and session-signing secrets, saves them without printing them to untracked `.env.local`, creates the local database, and applies the migration.

The local database is normally `var/data/intellitrex.sqlite`. All runtime data under `var/` is excluded from Git. The setup command retains existing complete secrets and refuses to replace a partial secret setup. Restart the dev server after configuration changes.

Open `/admin` and use **Unlock Model Settings** with the password chosen during setup. You do not need to use the old demo admin credentials for this section.

1. Select **Add configuration**.
2. Enter a friendly name, provider, exact model ID, and the provider's API key.
3. Save; the entry starts inactive.
4. Select **Test connection** and confirm the small billable provider request.
5. Select **Activate** to use that connection for subsequent advisor requests.

Examples of configuration values, not guarantees of account access:

| Provider | API root | Model ID format |
| --- | --- | --- |
| OpenAI | `https://api.openai.com/v1` | Provider model ID, such as `gpt-4o-mini` |
| OpenRouter | `https://openrouter.ai/api/v1` | Organization/model ID, such as `openai/gpt-4o-mini` |

Use a model supporting non-streaming text chat completions with the configured output budget. Reasoning models may consume the budget before returning text; an empty response is reported explicitly. The app does not retry or select another configured model automatically. OpenRouter may perform its own upstream provider routing under its service policies.

## Editing and deletion

- A blank replacement-key field keeps the saved key.
- A name-only edit keeps the active status.
- Changing the endpoint, model ID, or API key deactivates the entry; test and activate it again explicitly.
- Only inactive entries can be deleted. Activate a replacement before deleting the active one.
- Deleting an entry removes it from the live application store, but does not revoke its key with the provider or securely erase copies from old database pages/backups. Revoke the key at the provider when required.
- A connection test does not activate, delete, or otherwise change the entry.

## Optional import of the old OpenAI configuration

If `OPENAI_API_KEY` already exists in the server environment:

```sh
npm run model-settings:import
# Or supply another compatible OpenAI model ID:
npm run model-settings:import -- your-model-id
```

The command creates an inactive encrypted entry, defaults to `gpt-4o-mini`, and skips an already-imported entry with the same name/root/model. Test and activate it through the UI. There is no automatic fallback to the old environment key if no database model is active.

## Database commands

```sh
npm run db:migrate
npm run db:verify
npm run db:backup -- /absolute/protected/path/new-backup.sqlite
npm test
```

`db:migrate` initializes or upgrades the schema explicitly. Runtime refuses a missing or incompatible database rather than creating a new empty file during a request. `db:verify` checks schema, integrity, active-state invariants, and decryptability without printing keys. Backup uses SQLite's consistent backup API and refuses to overwrite an existing destination. Provision the backup directory first.

Retain the encryption key separately from database backups. Restore procedures and engine migration guidance are in [database architecture](./database-architecture.md).

## Production configuration

Use one persistent host/instance. Provision `/var/lib/intellitrex` or an equivalent persistent local volume with restricted service-account permissions. Do not use an ephemeral filesystem or a network share for this SQLite WAL deployment.

Configure these server-side values through the deployment secret manager/environment:

```text
MODEL_CONFIG_DATABASE_ENGINE=sqlite
MODEL_CONFIG_DATABASE_PATH=/var/lib/intellitrex/intellitrex.sqlite
MODEL_CONFIG_ENCRYPTION_KEY=<base64-encoded random 32-byte key>
MODEL_SETTINGS_ADMIN_PASSWORD_HASH=<scrypt password hash>
MODEL_SETTINGS_SESSION_SECRET=<independent base64-encoded random 32-byte key>
```

Generate a local setup in a controlled environment if you need to provision the initial hash/secrets, then transfer the values through your secret manager. Do not run local setup with `NODE_ENV=production`; it intentionally refuses to generate production secrets. In dotenv files the scrypt hash's `$` separators must be escaped as `\$`; direct environment values must contain the literal separators without backslashes.

Run migrations against the provisioned path before starting the application. Preserve the same encryption key across deployments. Serve production over HTTPS: the operator cookie is Secure, HttpOnly, SameSite=Strict, scoped to `/api/admin`, and expires after one hour.

Reverse proxies must preserve the application's external host/protocol so the exact-origin checks match browser requests. Do not bypass origin validation to work around a misconfigured proxy.

## Operational limitations

- Operator sessions are stateless. Sign-out clears the current browser cookie; it does not revoke a copied token before expiry. Rotating the signing secret or operator password hash invalidates existing tokens.
- Operator login is limited to 20 attempts per 15 minutes per process. That limiter resets on restart and can temporarily affect all operators; distributed deployment requires shared enforcement.
- The public chat endpoint and existing account usage limits remain outside this feature's authentication scope. This change does not claim to harden user access or billing.
- Arbitrary provider hosts are blocked in this first release. Add a reviewed adapter/host policy before supporting another API root.
- Infrastructure failures return controlled errors. Failed advisor calls restore the typed message and do not consume the browser's response allowance or save an infrastructure error as an assistant reply.

## Verification record

The feature test suite uses temporary databases and mocked provider calls; it includes persistence/reopening, encrypted credential handling, concurrent activation from independent processes, rollback, backup restoration, operator/session protection, configuration routes, and the active chatbot integration.

Implementation verification passed 25 named checks, TypeScript checking, lint for the new backend/UI/scripts/tests, and the production build. The interactive setup command was exercised in a disposable directory. A running development server also passed HTTP checks for operator access and the configuration lifecycle. Repository-wide lint still reports existing effect-related errors in files outside this backend feature; no rules were disabled.

No browser was available in the execution environment, so visual, keyboard, and mobile browser verification remains outstanding. HTTP page rendering was checked, but that does not substitute for a hydrated browser interaction check.

Actual provider access must be verified with the operator's own credentials using **Test connection** and a real advisor request. Mocked tests do not establish account permissions, quota, model availability, or external network reachability.
