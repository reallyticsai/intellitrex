# Database architecture and operations

## Purpose and scope

This document defines the database setup for model configuration management. It complements [the implementation plan](./model-configuration-implementation-plan.md). The implementation now follows these boundaries; see [setup and operations](./model-settings-setup.md) for initialization and usage.

The first release has exactly one application table: `model_configurations`. User accounts, authentication records, chat history, subscriptions, and portfolios are outside this database scope.

SQLite is the initial engine. Application behavior will depend on a small repository contract rather than SQLite APIs, allowing a future engine change without rewriting the UI or chatbot.

## Where the database lives

Keep executable code, database files, deployment settings, and backups separate.

| Environment | Database location | Configuration location |
| --- | --- | --- |
| Local development | `<project-root>/var/data/intellitrex.sqlite` | Untracked `.env.local` at the project root |
| Automated tests | Unique temporary directory per test run, removed afterward | Explicit test configuration supplied by the test harness |
| Production host | `/var/lib/intellitrex/intellitrex.sqlite`, or an equivalent mounted persistent volume | Host environment or secret manager |
| Container deployment | Persistent volume mounted at `/var/lib/intellitrex` | Deployment environment and injected secrets |

For this checkout, the proposed local path is `/home/hope/Projects/intellitrex/var/data/intellitrex.sqlite`. Do not hardcode this machine-specific path in source code.

The production path is an example, not a directory to create during local development. Provision it through deployment tooling with ownership assigned to the application service account.

Never place the database under `public/`, `src/`, `.next/`, a temporary production directory, or a build artifact. Deployments must not delete the data volume. Independent replicas must not each create their own database and present them as one shared store.

With WAL enabled, SQLite may create sibling `-wal` and `-shm` files. The service needs write access to the containing directory. WAL requires processes using the database to be on the same host; do not put this setup on a network filesystem. [SQLite WAL documentation](https://www.sqlite.org/wal.html)

## Configuration ownership

Use one server-only configuration module: `src/lib/server/config.ts`.

It reads environment variables, applies documented development defaults, validates values, and returns a typed immutable configuration. Other modules receive these values through composition rather than repeatedly reading `process.env`.

Example local configuration:

```env
MODEL_CONFIG_DATABASE_ENGINE=sqlite
MODEL_CONFIG_DATABASE_PATH=./var/data/intellitrex.sqlite
MODEL_CONFIG_ENCRYPTION_KEY=<base64-encoded-random-32-byte-key>
MODEL_SETTINGS_ADMIN_PASSWORD_HASH=<operator-password-hash>
MODEL_SETTINGS_SESSION_SECRET=<independent-random-signing-secret>
```

The implementation plan already names these settings, except for `MODEL_CONFIG_DATABASE_ENGINE`, which this document adds to make the selected storage engine explicit.

Rules:

- Resolve a relative path against the documented project root in development and turn it into an absolute path once.
- Require an explicit absolute database path in production; do not depend on a process working directory that may change across deployments.
- Default the engine to `sqlite`; reject unsupported values. Setting it to `postgres` must fail until that adapter is implemented.
- Validate that decoded encryption key length is exactly 32 bytes and that operator secrets are present before enabling management endpoints.
- Never prefix these variables with `NEXT_PUBLIC_`.
- Do not put individual provider API keys in these variables; those keys are encrypted in the database through the settings UI.
- Missing secrets must produce a clear configuration error, never a generated replacement key or a hardcoded fallback.
- Do not open or mutate the production database while bundling the app. Validate/open it during an explicit setup command or runtime initialization.

Commit a placeholder-only `.env.example` with documented fields during implementation. The current `.gitignore` ignores all `.env*` files, so add an explicit exception for `.env.example`. Real values stay untracked and are injected by the operator.

## Code layout and responsibilities

Use this layout as the database-focused refinement of the earlier implementation plan:

```text
src/lib/server/
  config.ts
  credential-encryption.ts
  model-configurations/
    types.ts
    validation.ts
    repository.ts
    service.ts
    index.ts
  database/
    index.ts
    errors.ts
    sqlite/
      connection.ts
      model-configuration-repository.ts
      migrate.ts
      migrations/
        001-model-configurations.sql
scripts/
  database-migrate.*
  database-backup.*
  database-verify.*
var/data/                         # local runtime files, ignored
docs/database-architecture.md
.env.example                      # placeholders only
```

Do not implement empty future adapters or a generic database framework. Add a PostgreSQL folder only when that migration is actually needed.

| Layer | Responsibility | Must not do |
| --- | --- | --- |
| UI | Forms, loading/error states, operator actions | Read database files, hold saved keys, or execute SQL |
| Route handlers | Verify access, parse requests, map outcomes to HTTP | Contain raw SQL or provider-specific storage logic |
| Configuration service | Apply lifecycle rules, encrypt incoming keys, return safe output | Know SQLite syntax or HTTP response objects |
| Repository contract | Describe persistence operations required by this feature | Expose driver statements, connections, or query builders |
| SQLite repository | Execute parameterized SQL and atomic state transitions | Make provider HTTP calls or decide UI behavior |
| Connection/migrations | Open the engine and manage its schema | Automatically activate models or seed real credentials |

Mark all secret-handling and database modules server-only. Use a single composition entry point to construct the repository and service. Routes import that entry point; tests can supply a temporary repository explicitly.

The chatbot loads the active configuration through the same service. The provider client receives a short-lived decrypted credential for an outbound call; decryption does not belong in SQL or the browser.

## Repository contract and portability

Expose only the operations needed now:

```text
list()
findById(id)
findActive()
create(record)
update(id, changes)
activate(id)
deleteInactive(id)
```

Use an asynchronous contract returning ordinary typed values, even if the initial driver executes synchronously. Keep secrets in an internal record type and define a separate public view without ciphertext. Avoid spreading internal records directly into API responses.

Document precise method outcomes: not found, active-delete conflict, storage unavailable, and successful mutation. Normalize engine errors at the repository boundary; do not leak driver codes into the UI.

`activate`, `deleteInactive`, and updates that deactivate a changed connection must enforce their rules atomically within the adapter. A read followed by an unrelated write is not sufficient under concurrency.

IDs are application-generated strings. Timestamps use a consistent UTC format. Convert SQLite integer booleans to application booleans in the adapter. A future PostgreSQL adapter may use native timestamp/boolean columns while returning the same application types.

Changing engines requires an adapter, migrations, data transfer, and verification. An environment variable alone cannot perform that work.

## Schema and integrity rules

Use the `model_configurations` schema defined in the implementation plan as the initial schema; keep executable SQL in the migration file as the source of truth.

- Server-generated `id` is the primary key.
- Required connection values are validated before persistence.
- `api_key_encrypted` contains a versioned authenticated-encryption envelope.
- `is_active` defaults to false and accepts only valid boolean representations.
- A unique partial index permits at most one active row.
- Activating an entry clears the previous active flag in the same transaction.
- Deleting an active entry is rejected; activating a replacement is explicit.
- Changing an active entry's endpoint, model, or key deactivates it atomically.
- A name-only edit does not deactivate the entry.
- Multiple inactive entries and an empty database are valid states.

Display names are not identities and need not be unique. Encryption is for provider key values; SQLite itself is not encrypted by this design. File access controls and protected backups still matter.

## Connection lifecycle and SQLite settings

The implementation uses Node 24's built-in `node:sqlite` driver after verifying the local runtime. Keep it behind the SQLite adapter; the package engine constraint documents the supported Node release line.

Recommended initial settings, subject to runtime verification:

```sql
PRAGMA journal_mode = WAL;
PRAGMA synchronous = FULL;
PRAGMA busy_timeout = 5000;
PRAGMA foreign_keys = ON;
```

Check that WAL was enabled successfully. `FULL` is the initial durability preference for infrequent configuration writes. WAL permits concurrent readers but still has a single writer; keep transactions short and exclude external API calls from them. [SQLite WAL documentation](https://www.sqlite.org/wal.html)

Reuse one connection per process where appropriate; development hot reload must not leak connections. Close test connections before removing temporary files. Return controlled storage errors on lock timeout or disk failure; do not endlessly retry writes.

Do not open connections at module import in a way that performs build-time filesystem writes. Normal runtime should require an existing migrated production file rather than silently creating an empty database at a mistyped path.

## Migrations and initialization

For one SQLite application table, track migration version with `PRAGMA user_version`; no migration application table is needed.

1. The explicit migration command reads validated configuration and opens the target path.
2. Development setup may create its known local data directory; production directories are provisioned by deployment tooling.
3. Read the current schema version and reject versions newer than the application supports.
4. Apply pending migrations in order with a write transaction and recheck version after obtaining the lock.
5. Update the version only after the associated schema change succeeds.
6. Verify the expected table and index, then close the setup connection.

Run migrations as a deployment step before serving traffic. Runtime checks schema compatibility and reports a missing migration clearly. This refines the earlier plan's initialization proposal: initialization is repeat-safe, but production schema changes are explicit rather than performed by an arbitrary HTTP request.

Treat released migration files as immutable. Add a new migration for later changes. Back up before destructive schema operations; prefer a forward repair or verified backup restoration over an untested down migration.

Future engines have their own migration files and version tracking; `PRAGMA user_version` is SQLite-specific and must not cross the repository boundary.

## File permissions, secrets, and Git hygiene

Provision data directories for the application service account, with restrictive permissions such as `0700` for the directory and `0600` for files on Unix. Ensure generated WAL files inherit restrictive permissions, and verify behavior on the target host.

Add targeted Git exclusions for local data, database siblings, and local backups. Never commit production exports, real credentials, or decrypted rows. Keep backup destinations outside the checkout in production.

The encryption key is independent of the operator session signing secret. Preserve both across redeployments. Rotating the encryption key requires controlled re-encryption; deleting it makes existing encrypted API keys unreadable.

Log operation names, durations, counts, and sanitized failure categories. Do not log keys, ciphertext, provider request headers, database exports, or database URLs with passwords.

## Backup and restore

Use the SQLite backup API, or a driver-supported equivalent, to create a consistent live snapshot. Do not copy only the main file while ignoring an active WAL. [SQLite backup documentation](https://www.sqlite.org/backup.html)

Define a daily backup schedule and make an additional backup before migrations or database-engine transfers. Adjust retention to operational needs; protect backup files as sensitive data and keep an off-host copy. Store the encryption key through a separate protected recovery mechanism.

Restore procedure:

1. Stop application writes.
2. Preserve the existing database directory as a rollback snapshot.
3. Restore a verified backup with the matching encryption key and expected ownership.
4. With all database connections closed, ensure no old WAL/SHM files from the previous database are mixed with the restored file.
5. Run SQLite integrity checking and schema version verification.
6. Verify record count, at-most-one-active state, and successful credential decryption without printing credentials.
7. Start the app and verify settings listing and one operator-authorized provider call.

Practice restoration using an isolated environment. A backup that has never been restored is incomplete operational evidence.

## Switching to another engine later

Move to a client/server database when deployment topology or write concurrency requires it; SQLite remains appropriate for this small store on one persistent host. [SQLite deployment guidance](https://www.sqlite.org/whentouse.html)

PostgreSQL is an example future target, not a new dependency for this iteration.

### Preparation

1. Implement the same repository contract using PostgreSQL.
2. Add target-specific schema migrations and constraints.
3. Retain the unique-active guarantee; in PostgreSQL, use an appropriate unique partial index and serialize activation with a transaction-level coordination mechanism shared by all activation operations.
4. Add validated `MODEL_CONFIG_DATABASE_URL` configuration for the new adapter; use managed credentials and appropriate connection pooling.
5. Run the same repository contract tests against both engines, including concurrent activation and active deletion.

### Transfer and cutover

1. Schedule a brief maintenance window and stop writes to the SQLite store.
2. Back up and verify the source database and recovery key.
3. Initialize the destination schema.
4. Transfer rows through a purpose-built server-side command, preserving IDs, timestamps, and active state.
5. Transfer encrypted envelopes directly only if the same envelope format and key are retained; otherwise decrypt and re-encrypt in memory without writing plaintext exports.
6. Compare record counts, IDs, values, and active-state invariants; verify decryption in the destination.
7. Set the engine and connection configuration, deploy the new adapter, and restart the app.
8. Verify list, create, edit, activate, delete, and chat behavior before reopening writes.
9. Preserve the SQLite source as a read-only rollback snapshot for the agreed retention period.

Do not dual-write databases in this iteration. Before new destination writes, rollback can switch back to the frozen SQLite source. After writes resume, rollback needs a reverse transfer or reconciliation; simply switching the engine would lose those changes.

The UI, settings API contracts, and advisor prompts should stay the same across this migration. The adapter and operational tooling change.

## Verification and operational readiness

Before shipping:

- Confirm the real persistent path, permissions, and restart/redeployment behavior.
- Verify setup is repeat-safe and runtime rejects missing or incompatible schemas.
- Verify migration rollback on failure and activation correctness under concurrent requests.
- Verify provider secrets never appear in read APIs or plaintext database rows.
- Test storage-unavailable behavior separately from no-active-model behavior.
- Verify a backup restoration and wrong-encryption-key failure.
- Document the supported Node/driver versions and production topology.
- Confirm builds and test runs cannot modify production data.
- Record the small set of setup, migration, backup, and verification commands in deployment documentation.

## Guiding decisions

Keep one table, one supported engine, and one narrow persistence contract initially. Put SQL inside the engine adapter, business rules inside the configuration service, and infrastructure values inside the validated configuration module. Make schema changes deliberate, keep credentials separate from public views, and establish recovery procedures before relying on saved configurations.
