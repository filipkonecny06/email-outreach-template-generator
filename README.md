# OutreachOps

[![CI](https://github.com/filipkonecny06/email-outreach-template-generator/actions/workflows/ci.yml/badge.svg)](https://github.com/filipkonecny06/email-outreach-template-generator/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-0f766e.svg)](LICENSE)

OutreachOps is a server-rendered workspace for drafting and organizing outreach emails. It combines a version-controlled template catalog with authenticated favorites, history, export tools, and a MySQL-backed operational workflow.

## Capabilities

- 24 campaign patterns covering guest posts, broken links, attribution, research, podcasts, partnerships, creator outreach, and PR.
- Template-specific input fields driven by catalog metadata, with authoritative validation on the server.
- Direct, friendly, and formal tone options plus short, medium, and long output profiles.
- Optional two-step follow-up sequences; inputs used only by follow-ups stay optional until the sequence is enabled.
- Authenticated favorites and generation history.
- Plain-text copy, TXT download, and spreadsheet-safe CSV export.
- Schema validation, dry-run catalog synchronization, migrations, and database smoke checks.

## Architecture

```text
data/template-catalog.json
        |
        v
TemplateCatalogRepository -> TemplateCatalogService -> MySQL Templates
                                                        |
Browser -> Express routes -> controllers -> TemplateGenerationService
                                         -> TemplateRepository
                                                        |
                                                        v
                                             plain-text draft/history
```

The main boundaries are named and independently testable:

- `TemplateCatalogRepository` reads the on-disk catalog.
- `TemplateCatalogService` validates catalog structure and synchronizes catalog-owned records.
- `src/contracts/outreach.js` is the source of truth for generator fields, validation limits,
  tones, and lengths used by rendering and server-rendered controls.
- `TemplateRepository` contains template and favorite persistence used by browsing and generation.
- `HistoryRepository` and `HistoryService` keep ownership, filtering, and pagination out of HTTP
  controllers.
- `TemplateBrowserController` prepares server-rendered template pages.
- `ApiController` owns the JSON API contract.
- `TemplateGenerationService` enforces the selected template's required fields before rendering.
- `OutreachTemplateRenderer` applies the catalog content, tone, length, and follow-up rules.
- `OutreachGeneratorController` coordinates the generator page lifecycle and delegates browser work.
- `OutreachApiClient` owns browser request construction and API error parsing.
- `OutreachFormView` owns field visibility, form serialization, and safe preview rendering.
- `OutreachTemplateListController` owns template filtering, selection, and favorite actions.
- `OutreachExportService` owns clipboard, text download, and spreadsheet-safe CSV export.

## Requirements

- Node.js 22.13 or later in the 22.x line, or Node.js 24.x
- npm
- MySQL 8.4+

Docker Compose can provide the local database and application runtime instead.

## Local setup

Install dependencies and create a local environment file:

```bash
npm ci
cp .env.example .env
```

PowerShell equivalent:

```powershell
npm.cmd ci
Copy-Item .env.example .env
```

Replace `SESSION_SECRET` in `.env` with a unique value. One way to generate it is:

```bash
node -e "console.log(require('node:crypto').randomBytes(48).toString('base64url'))"
```

Create the configured MySQL database and user. The following matches the development-only
credentials in `.env.example` when MySQL accepts TCP connections from `127.0.0.1`:

```sql
CREATE DATABASE outreach_generator CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'outreach'@'127.0.0.1' IDENTIFIED BY 'outreach';
GRANT ALL PRIVILEGES ON outreach_generator.* TO 'outreach'@'127.0.0.1';
FLUSH PRIVILEGES;
```

Use a unique password outside local development and update `DB_PASSWORD` to match. Then
initialize and start the application:

```bash
npm run db:setup
npm run dev
```

Open `http://localhost:3000`.

The database setup also provisions an ordinary, non-admin portfolio demo account through the
same user model and password hashing used by registration:

```text
Email: demo@example.com
Password: OutreachOps-Portfolio-2026!
```

These credentials are intentionally public and appear on the login page. The account is shared,
so never store sensitive or personal information in it. Re-running `npm run db:setup` safely
restores the documented password if the database record has drifted.

For a disposable local stack:

```bash
docker compose up --build
```

The credentials in `docker-compose.yml` are development-only. Source directories are mounted
into the development container, so nodemon observes local source edits; rebuild after changing
dependencies or image configuration.

If ports 3000 or 3306 are already occupied, choose alternate host ports without changing the
container configuration:

```bash
APP_HOST_PORT=3001 MYSQL_HOST_PORT=3307 docker compose up --build
```

PowerShell equivalent:

```powershell
$env:APP_HOST_PORT = '3001'
$env:MYSQL_HOST_PORT = '3307'
docker compose up --build
```

## Catalog operations

`data/template-catalog.json` is the source of truth for catalog-owned templates. Every entry has a stable key, required input fields, content blocks, and follow-up definitions. The application derives follow-up-only requirements from where each declared field is used, avoiding a second metadata list that could drift from the template text.

```bash
npm run catalog:validate       # validate schema and cross-field rules
npm run catalog:list           # list catalog entries
npm run catalog:sync:dry-run   # preview database changes
npm run catalog:sync           # transactionally reconcile catalog-owned rows
```

The dry run reports creates, updates, unchanged records, and stale catalog keys without writing. Apply mode deletes stale catalog-owned rows inside the same transaction; manually created rows have no catalog key and are never included.

## Database and session operations

```bash
npm run db:migrate
npm run db:migrate:undo
npm run db:smoke
```

The application and MySQL session store share the same TLS configuration:

- `DB_SSL=true` enables TLS.
- `DB_SSL_REJECT_UNAUTHORIZED=true` verifies the database certificate and is the safe default.
- `DB_SSL_CA` accepts a certificate authority value with line breaks encoded as `\n`.

Back up production data before migrations. Run `db:setup` as a release step, not concurrently in every application replica. The Dockerfile provides separate `migration` and `production` targets for that workflow.

Migration `20260828000100-remove-generation-history-soft-delete` permanently purges rows that were already soft-deleted before removing the legacy column. Its rollback restores the column only; it cannot restore purged content. The database smoke command defaults to the current schema; pass `-- --schema=legacy` when deliberately checking the rolled-back state. Current mode requires the hard-delete schema and the ordered `(UserId, createdAt, id)` pagination index; legacy mode requires `deletedAt` and rejects that index. CI checks current, rolls back both new migrations, checks legacy, and then reapplies and checks current again. No rollback can recover rows purged by the original `up` migration.

## Quality checks

```bash
npm run catalog:validate
npm run check
npm run audit:production
```

`npm run check` runs formatting, linting, and the Node test suite with aggregate and
risk-focused per-file coverage gates. Thresholds live in `package.json` and
`scripts/check-file-coverage.js` so the executable policy remains the source of truth. Tests cover
browser-side behavior plus an authenticated HTTP workflow through registration, rendering,
preview, favorites, history, deletion, and logout. Process startup, database bootstrap modules,
the small browser bootstrap, EJS templates, and migrations are checked through rendering
assertions, catalog checks, Docker builds, and the MySQL migration job rather than coverage alone.
CI runs the quality suite on Node 22 and 24, builds both Docker targets, exercises migrations and
catalog synchronization against MySQL 8.4, and starts the production image for a bounded
liveness probe.

## Security and runtime behavior

- State-changing requests require a synchronizer token tied to the server-side session. Browser API mutations send it in the `X-CSRF-Token` header; server-rendered forms use the `_csrf` field.
- Authentication rotates the session identifier.
- Password validation rejects values beyond bcrypt's 72-byte UTF-8 input limit.
- Deleting a saved history entry permanently removes the owned database row.
- Request bodies, rate limits, secure headers, and content security policy are configured centrally.
- Session-aware HTML and JSON responses use `Cache-Control: no-store`; stable public asset filenames use ETag revalidation with `max-age=0`, and the stateless liveness response bypasses session state.
- Expected 4xx responses use a consistent API error envelope and concise warning logs; unexpected failures retain server-side stack traces.
- `/healthz` is a dependency-free, `no-store` liveness endpoint and does not create a session.
- Startup waits for both the application database and session store. Shutdown stops accepting traffic and closes both pools within a bounded window.

The application drafts text only. Review recipients, claims, links, consent, and applicable messaging rules before using any output. It does not send email or collect website data.

## License

[MIT](LICENSE)
