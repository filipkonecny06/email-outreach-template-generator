# OutreachOps — deterministic outreach-email workshop

OutreachOps is a portfolio project for creating clear, reviewable outreach drafts from a version-controlled template catalog. It deliberately does **not** claim that a message will convert or that it replaces editorial judgment. The goal is to show secure server-rendered product engineering, catalog operations, and transparent deterministic generation.

## What makes it interesting

- 18 distinct campaign patterns across guest posts, broken links, attribution, research, podcast, partnership, creator, and PR work.
- Tone and length alter the generated copy through explicit, inspectable rules—not an opaque model call.
- The catalog lives in `data/template-catalog.json`, is schema-validated, and can be safely listed, checked, or synchronized into MySQL.
- Server-side rendering prevents a client from forging saved generation content. Plain-text output is escaped only at the browser boundary, so copy, CSV, downloads, and history do not contain HTML entities.
- MySQL-backed sessions, session rotation after authentication, synchronizer-token CSRF protection, input limits, rate limits, CSP, structured JSON logging, and request IDs are built in.

## Architecture

```text
JSON catalog ──> TemplateCatalogService ──> MySQL Templates
                         │
Browser ─> Express routes/controllers ─> TemplateGenerationService ─> OutreachTemplateRenderer
                         │                                            │
                         └── session + CSRF + validation               └── plain-text draft + follow-ups
```

Named classes express stable boundaries:

- `TemplateCatalogRepository` owns on-disk catalog access.
- `TemplateCatalogService` validates, converts, and synchronizes editable catalog entries.
- `TemplateRepository` isolates Sequelize querying.
- `TemplateGenerationService` validates selected-template requirements and derives output on the server.
- `OutreachTemplateRenderer` renders tone/length profiles without coupling domain text to HTML.

Small transformations remain functions rather than becoming ceremonial classes.

## Quick start

Requires Node 22+ and MySQL 8+, or Docker Desktop.

```bash
npm ci
Copy-Item .env.example .env
npm run catalog:validate
npm run db:setup
npm run dev
```

Open `http://localhost:3000`.

For a local disposable stack:

```bash
docker compose up --build
```

The Compose credentials are only for local development. Use a unique `SESSION_SECRET`, managed database credentials, HTTPS, and a trusted-proxy policy in every deployed environment.

## Manual catalog management

The source of truth is `data/template-catalog.json`. Each entry has a stable `key`, its required fields, content blocks, and two follow-ups. Edit that file, then use:

```bash
npm run catalog:validate       # schema + semantic validation
npm run catalog:list           # inspect catalog entries
npm run catalog:sync:dry-run   # report creates/updates without writing
npm run catalog:sync           # apply idempotent creates/updates to MySQL
```

The seeder only affects catalog-keyed rows; it does not delete manually created templates during rollback.

## Quality gates

```bash
npm run check
npm audit --omit=dev --audit-level=high
```

`npm run check` runs formatting, linting, and a Node test suite with coverage thresholds on the core catalog, environment, renderer, and generation services. GitHub Actions runs these checks, catalog validation, and the high-severity production audit on every pull request.

## Security model and trade-offs

- State-changing requests require a synchronizer CSRF token stored in the server-side session.
- Login and registration rotate the session identifier to reduce session-fixation exposure.
- Passwords are bcrypt-hashed; validation caps their byte-safe length.
- The app has generic public errors and structured server-side logs. Runtime logs are written to stdout, not committed files.
- Catalog content is operational data, not user input. User-provided values remain plain text and EJS escapes them at output boundaries.
- The app uses Sequelize 6 because it keeps the codebase approachable for the portfolio scope. The lockfile is audited in CI at high severity; revisit the ORM migration when a stable supported major version fits the deployment target.

## Useful operations

```bash
npm run db:migrate
npm run db:migrate:undo
npm run db:seed
npm run db:seed:undo
curl http://localhost:3000/healthz
```

Back up MySQL before migrations in a real environment, run migrations as a release step, and monitor the liveness endpoint plus application logs. The `/healthz` endpoint is a liveness check; the server only starts after it can authenticate to MySQL.

## Limitations

- The generator drafts text; users must verify facts, linking policies, tone, consent, and anti-spam compliance before sending.
- It does not send emails, scrape websites, or make claims about deliverability or conversion.
- The included Docker Compose stack is developer tooling, not a production deployment blueprint.

## License

[MIT](LICENSE).
