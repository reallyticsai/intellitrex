# Intellitrex

Intellitrex is a cryptocurrency research and analytics application that combines market charts, technical indicators, externally generated forecasts, an AI consultant, and portfolio analysis.

The application uses Next.js for both its interface and backend API routes. Model Settings lets an operator save multiple OpenAI or OpenRouter connections in SQLite and choose the connection used by the shared AI consultant.

**Project status:** an actively developed prototype with persistent model configuration management; user authentication, billing, and several advertised trading features remain incomplete.

## Contents

- [Features and current status](#features-and-current-status)
- [Requirements](#requirements)
- [Quick start](#quick-start)
- [Configure the AI consultant](#configure-the-ai-consultant)
- [Use the application](#use-the-application)
- [Configuration](#configuration)
- [Database and backups](#database-and-backups)
- [Development commands](#development-commands)
- [Architecture](#architecture)
- [Deployment](#deployment)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)
- [Documentation](#documentation)
- [License and disclaimer](#license-and-disclaimer)

## Features and current status

| Area | Current implementation |
| --- | --- |
| Market dashboard | CoinGecko price charts for 10 cryptocurrencies, SMA, RSI, and Bollinger Bands. |
| Market sentiment | Fear & Greed Index from Alternative.me. |
| Forecast display | Reads forecasts, predictions, and metrics from a separate GitHub workflow repository for XGBoost, Prophet, NHITS, GRU, and Ensemble. |
| AI consultant | Risk-Averse, Active Trader, and Learning prompts, using the active saved provider connection. |
| Model Settings | Add, edit, test, activate, and delete saved connections through a server-protected section in `/admin`. |
| Model persistence | One SQLite application table, encrypted provider keys, migrations, verification, and backup commands. |
| Portfolio analysis | Binance account holdings mapped to available forecast data using submitted API credentials. |
| Profiles and chat history | Browser-local records and conversation history; these are not database-backed user accounts. |
| Appearance | Light and dark themes. |

Supported cryptocurrencies: BTC, ETH, SOL, XRP, ARB, DOT, LINK, KSM, PYTH, and SUI.

### Current limitations

- User sign-in is a browser-based demonstration: email identity is not verified and Google OAuth is not implemented.
- Premium upgrades do not process a payment; billing and server-enforced subscription limits are unfinished.
- The existing user/admin demonstration is separate from Model Settings operator authentication.
- The public chat API does not enforce verified user authentication or account quotas on the server.
- The chatbot does not automatically receive live market data or portfolio holdings.
- Forecast model training runs outside this repository, and forecast availability depends on that external workflow.
- Chart ranges still have a known candle-count versus duration issue, and some market-data failure states need improvement.
- Paper trading, trade execution, trading alerts, and structured learning simulations are not implemented.
- Some homepage descriptions still refer to Kraken or more supported coins than the current implementation provides.

## Requirements

- **Node.js 24.15.0 or later within Node 24** (`>=24.15.0 <25`).
- npm, using the committed `package-lock.json`.
- An interactive terminal for initial local operator setup.
- Writable local storage for SQLite.
- Internet access for external market services and model providers; the production build also fetches the existing Google Fonts.
- An OpenAI or OpenRouter API key with access to a compatible text chat model to enable advisor responses.

SQLite uses Node's built-in `node:sqlite` driver. No separate database server is required. Node may report this API as experimental.

## Quick start

### 1. Obtain the project and install dependencies

For a fresh checkout:

```sh
git clone https://github.com/hopeogbons/intellitrex.git
cd intellitrex
npm ci
```

If the project is already checked out, run `npm ci` from its root directory.

### 2. Initialize Model Settings

```sh
npm run model-settings:setup
```

Choose and confirm an operator password of at least 12 characters. Input is hidden.

The command creates the local SQLite database, applies its migration, and saves independent encryption and session-signing secrets plus the password hash in untracked `.env.local`. It does not print the secrets.

You do not need to copy `.env.example` before using this command. That file documents the available settings for manual or deployment configuration.

Complete existing secrets are retained. A partial secret setup is rejected rather than overwritten; resolve it using the configuration guidance below. Never discard an existing encryption key to restart setup if you have saved provider credentials.

### 3. Start the application

```sh
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Restart the development server after changing environment configuration. The advisor remains unconfigured until a saved model is activated.

## Configure the AI consultant

1. Open [http://localhost:3000/admin](http://localhost:3000/admin).
2. In **Model Settings**, enter the operator password created during setup and select **Unlock Model Settings**.
3. Select **Add configuration**.
4. Enter a display name, choose the provider, enter its exact model ID, and supply its API key.
5. Save the entry. New configurations are inactive and do not replace existing entries.
6. Select **Test connection** and confirm the small provider request, which may incur charges.
7. Select **Activate** to use the configuration for subsequent advisor requests.

| Provider | API root | Example model ID |
| --- | --- | --- |
| OpenAI | `https://api.openai.com/v1` | `gpt-4o-mini` |
| OpenRouter | `https://openrouter.ai/api/v1` | `openai/gpt-4o-mini` |

Examples illustrate the ID format; model access depends on your provider account. Use a model supporting non-streaming text chat completions. Only these two API roots are accepted in this version.

The active connection applies to all advisor users. Advisor mode changes the prompt, while activation changes the provider/model connection. The app does not automatically retry with another saved model.

### Manage existing connections

- **Switch models:** activate a different entry; existing entries stay saved.
- **Edit:** leave the replacement-key field blank to keep the saved key.
- **Change connection details:** editing the provider, model ID, or key deactivates the entry; test and activate it again.
- **Rename:** a name-only change preserves active status.
- **Delete:** activate a replacement before deleting an active entry; inactive entries can be deleted directly after confirmation.
- **Lock settings:** ends access in the current browser. Operator access expires after one hour.

Deleting a configuration does not revoke its API key at the provider or erase historical backups. Revoke unwanted credentials through the provider when needed.

### Import an existing OpenAI key

If `OPENAI_API_KEY` already exists in the server environment:

```sh
npm run model-settings:import
# Optional: choose another compatible OpenAI model ID.
npm run model-settings:import -- your-model-id
```

The imported connection is inactive. Test and activate it through Model Settings. The chatbot does not automatically fall back to `OPENAI_API_KEY` when no database entry is active.

## Use the application

| Page | Purpose |
| --- | --- |
| `/` | Project overview and entry points. |
| `/currency` | Select a cryptocurrency, explore charts and indicators, and inspect available forecasts. |
| `/consultancy` | Choose an advisor mode and chat with the configured model. |
| `/profile` | Use the prototype name/email sign-in, revisit saved chats, and access portfolio tools. |
| `/admin` | Manage model connections using the operator password; the separate legacy admin area displays browser-local demo users. |

For an advisor conversation, first configure and activate a model, then use the profile's prototype sign-in and open `/consultancy`. Choose Learning, Risk-Averse, or Active Trader mode and send a message. Failed provider calls restore your typed message and do not consume the browser's response allowance.

For portfolio analysis, use a Binance API key with read-only account access and no trading or withdrawal permissions. Submit it through the profile's portfolio connection form. Results depend on Binance access and available external forecast files.

## Configuration

Model connections and provider keys are entered through the UI and stored in SQLite. Environment variables configure infrastructure and optional external access.

| Variable | Purpose |
| --- | --- |
| `MODEL_CONFIG_DATABASE_ENGINE` | `sqlite`; other engines are not implemented yet. |
| `MODEL_CONFIG_DATABASE_PATH` | SQLite file location; development defaults to `./var/data/intellitrex.sqlite`, while production requires an explicit absolute path. |
| `MODEL_CONFIG_ENCRYPTION_KEY` | Random 32-byte encryption key encoded as base64; preserve it across restarts and deployments. |
| `MODEL_SETTINGS_ADMIN_PASSWORD_HASH` | Operator password hash in the setup-generated scrypt format. |
| `MODEL_SETTINGS_SESSION_SECRET` | Independent random 32-byte signing key encoded as base64. |
| `GH_TOKEN` | Optional GitHub token for reading the external forecast repository. |
| `OPENAI_API_KEY` | Optional source for the explicit legacy-key import command; not the active chatbot configuration. |

Keep local values in `.env.local` and production values in the deployment environment or secret manager. Do not prefix secrets with `NEXT_PUBLIC_` or commit real credentials.

In dotenv files, the scrypt hash's `$` separators must be escaped as `\$`. Direct environment values use literal `$` separators without backslashes; the setup command handles the dotenv form automatically.

## Database and backups

The database currently contains one application table, `model_configurations`. User accounts, chat history, and portfolios are not stored there.

| Item | Location or behavior |
| --- | --- |
| Local database | `var/data/intellitrex.sqlite`, unless configured otherwise. |
| Production database | An absolute path on persistent local storage, such as `/var/lib/intellitrex/intellitrex.sqlite`. |
| Migrations | `src/lib/server/database/sqlite/migrations/`. |
| Schema version | SQLite `PRAGMA user_version`. |
| Credentials | Authenticated encryption; ordinary settings responses return no plaintext key or encrypted envelope. |
| Runtime files | Database and WAL/SHM siblings are excluded from Git. |

Initialize or apply migrations explicitly:

```sh
npm run db:migrate
npm run db:verify
```

Create a consistent backup in an existing protected directory:

```sh
npm run db:backup -- /absolute/protected/path/new-backup.sqlite
```

The backup command refuses to overwrite an existing destination. Retain the matching encryption key separately; a database backup alone cannot recover encrypted provider keys. Do not copy only an open SQLite main file while ignoring its WAL.

See [database architecture](docs/database-architecture.md) for permissions, restoration, repository boundaries, and a future database-engine migration. Changing an engine setting alone does not transfer data or implement a new adapter.

## Development commands

| Command | Purpose |
| --- | --- |
| `npm ci` | Install locked dependencies. |
| `npm run dev` | Start the development server. |
| `npm run build` | Compile and check the production application. |
| `npm start` | Start an already-built production application. |
| `npm test` | Run feature checks using temporary databases and mocked provider calls. |
| `npx tsc --noEmit` | Check TypeScript types. |
| `npm run lint` | Run repository-wide ESLint. |
| `npm run model-settings:setup` | Interactive local operator and storage initialization. |
| `npm run model-settings:import` | Import an existing OpenAI environment credential as inactive. |
| `npm run db:migrate` | Apply SQLite migrations. |
| `npm run db:verify` | Check schema, integrity, active-state rules, and credential decryption. |
| `npm run db:backup -- /absolute/path/new.sqlite` | Create a consistent database backup. |

The model configuration implementation was verified with 25 named checks, TypeScript, production compilation, and running-app HTTP checks. Tests do not make billable provider calls. Repository-wide lint has existing effect-related errors; see [the verification record](docs/model-settings-setup.md#verification-record). Live-provider access and visual browser checks require separate verification.

## Architecture

```text
Browser UI
  ├─ Market/profile pages → Next.js API routes → external data services
  └─ Model Settings → operator-protected API routes
                           ↓
                    configuration service
                           ↓
                    repository interface
                           ↓
                      SQLite adapter

AI consultant → /api/chat → active saved configuration → provider API
```

```text
src/app/                         Pages and backend route handlers
src/app/api/admin/               Operator session and model configuration endpoints
src/components/admin/            Model Settings interface
src/lib/server/config.ts        Validated server configuration
src/lib/server/model-configurations/
                                 Types, validation, service, and repository contract
src/lib/server/database/sqlite/  Connection, migrations, and SQLite repository
src/lib/server/credential-encryption.ts
                                 Provider credential encryption
src/lib/server/model-settings-auth.ts
                                 Operator password and session handling
src/lib/server/chat-completions-client.ts
                                 Compatible provider request handling
scripts/model-storage.ts         Setup, migration, verification, backup, and import CLI
tests/                           Automated feature checks
docs/                            Implementation and operational documentation
```

SQL stays inside the SQLite adapter. Routes handle access and HTTP concerns; the service handles configuration behavior and safe public responses. Database and secret-handling modules are server-only.

## Deployment

Use a **single persistent host or application instance** for the current SQLite design. Ephemeral serverless filesystems, network shares, and independently writable replicas are unsuitable for this setup.

1. Install the supported Node version and locked dependencies, including tooling required by the migration scripts.
2. Provision a persistent local data directory owned by the application service account.
3. Supply the operator hash, encryption key, signing secret, and absolute database path through protected deployment configuration.
4. Preserve existing encryption keys; do not regenerate them on each deployment.
5. Build the application with `npm run build`.
6. Run `NODE_ENV=production npm run db:migrate` against the provisioned database path.
7. Start the application with `npm start` behind HTTPS.
8. Confirm proxy host/protocol handling, operator unlock, database persistence, and a real provider response.
9. Establish protected backups and practice restoration.

Local setup intentionally refuses to generate production secrets under `NODE_ENV=production`. See [production configuration](docs/model-settings-setup.md#production-configuration) for provisioning guidance.

Model Settings uses a Secure production cookie and exact-origin checks. Its protection does not make the application's prototype user authentication or public chat usage controls production-ready. Review those areas and dependency advisories before broad public access.

## Troubleshooting

| Symptom | Action |
| --- | --- |
| Setup or SQLite APIs fail on an older Node version | Use the supported Node 24 release line, then reinstall with `npm ci`. |
| Model Settings reports setup is required | Run local setup or supply all required deployment secrets; restart the app. |
| Setup finds partial secrets | Complete the missing configuration manually; preserve existing keys and hashes. |
| Database is missing or schema is incompatible | Confirm the configured path and run the matching migration command. |
| Saved key cannot be decrypted | Restore the matching encryption key or replace the affected provider credential; do not generate a new key blindly. |
| Advisor reports no active model | Save and activate a connection in Model Settings. |
| Provider rejects the connection | Verify API key permissions, account quota, exact model ID, and chat-completions compatibility. |
| Operator session expires | Unlock Model Settings again; unsaved secret input is cleared. |
| Production login does not persist | Use HTTPS and verify cookie/proxy configuration. |
| A settings action fails its origin check | Correct the reverse proxy's external host/protocol handling. |
| Market or forecast data is unavailable | Check external service reachability, rate limits, and forecast repository access. |
| Build fails fetching fonts | Allow the existing Google Fonts requests in the build environment. |

## Contributing

Read [AGENTS.md](AGENTS.md) before making changes. This project uses Next.js 16.2.2; consult its installed guides under `node_modules/next/dist/docs/` before implementing framework-dependent code.

Keep changes focused, preserve the server/client boundary, use parameterized database queries, and update relevant documentation. Validate changed behavior with suitable tests, type checking, and a build. Report existing lint failures rather than suppressing unrelated rules.

## Documentation

- [Model Settings setup and operations](docs/model-settings-setup.md)
- [Database architecture and recovery](docs/database-architecture.md)
- [Model configuration implementation plan](docs/model-configuration-implementation-plan.md)
- [Repository instructions](AGENTS.md)

## License and disclaimer

No license file is currently included in this repository. Confirm licensing terms with the project owner before redistributing or reusing the code.

Intellitrex is a research and educational analytics platform. Its forecasts, indicators, and AI responses are not financial advice or guarantees of future results. Users remain responsible for their own investment decisions.
