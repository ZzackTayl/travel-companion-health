# Travel Companion Health

Travel Companion Health is a privacy-first web application for preparing to
travel with medicines. Users can build an airport route, add optional
medication categories, review explicit guidance coverage gaps, and copy, print,
or save a local travel card.

## Safety status

The checked-in guidance records are development fixtures. They are visibly
labeled as prototype data and are blocked in production. Production deployment
requires the governed PostgreSQL content path, reviewed evidence, freshness
jobs, and complete launch coverage.

The application is informational and is not legal or medical advice.

## Requirements

- Node.js 24.13.0
- npm 11.6.2
- PostgreSQL 15 or newer for database migrations

Use the versions in `.nvmrc` or `.node-version`.

## Install and run locally

```bash
npm ci
npm run dev
```

Open `http://localhost:3000`.

## Validation

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

Run the complete local gate with:

```bash
npm run validate
```

`npm test` runs both the Vitest application suite and the Node governance
suite. A passing governance suite alone is not a release signal.

## Database

Apply every SQL file in `database/migrations/` in numeric order, then apply
`database/seeds/launch_coverage.sql`. See `database/README.md` for the
publication and stale-content model.

The seed creates coverage requirements, not factual guidance. Missing coverage
must remain visible and resolve to an unknown state until a reviewer publishes
evidence-backed content.

## Privacy boundary

- Raw medicine names remain in the browser.
- Guidance requests send airport IDs, optional dates, and normalized category
  flags.
- Saved trips are stored in IndexedDB on the current browser profile.
- Travel card copy and print output omit raw medicine names.
- Users can delete individual saved trips or clear all saved trips.

## Production prerequisites

Before public beta:

1. Connect the public API to the governed database projection.
2. Publish authoritative reviewed content for every enabled launch requirement.
3. Configure managed admin authentication, MFA, and role-based authorization.
4. Configure distributed rate limiting, request timeouts, security headers,
   privacy-safe telemetry, backups, and restore/rollback procedures.
5. Run PostgreSQL role/RLS integration tests, browser E2E tests, automated
   accessibility checks, and manual screen-reader/zoom/print checks.
6. Verify official source contents and dates through the documented review
   workflow.

Product, QA, security, technical, and research documentation is in `docs/`.
