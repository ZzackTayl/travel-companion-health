# Release readiness

## Repository controls implemented

- Prototype guidance is blocked when `NODE_ENV=production`.
- Category-neutral guidance cannot satisfy category-specific coverage.
- Missing country and airport coverage is returned as an explicit unknown state.
- Fixture guidance has review expiry dates and is evaluated against the trip
  date when provided.
- Route/date requests reject adjacent duplicate stops, invalid calendar dates,
  incomplete ranges, reversed ranges, and contradictory category selections.
- POST APIs require bounded JSON bodies and return stable, non-cached errors.
- Saved snapshots carry a versioned guidance contract and display expiry
  warnings.
- Raw medicine names remain outside guidance requests and travel-card exports.
- The public admin placeholder has been removed.
- Database migration 002 repairs audit-trigger privileges, freezes reviewed
  records, and restricts evidence verification to reviewers/admins.
- Local and CI validation scripts run lint, type checks, all application tests,
  governance tests, and the production build.

## Blocking external work

Public beta remains blocked until all items below are complete:

1. Install dependencies and read the matching Next.js 16 guides under
   `node_modules/next/dist/docs/` before implementing framework-specific
   security headers or proxy behavior.
2. Connect `/api/guidance/evaluate` to a governed public database projection.
   Production intentionally returns 503 until this exists.
3. Research, review, and publish authoritative guidance for every enabled
   launch coverage requirement. The seed contains requirements, not facts.
4. Provision managed admin authentication with MFA, short-lived sessions, and
   server/database-enforced researcher, reviewer, and admin roles.
5. Configure distributed rate limiting and trusted client-IP handling at the
   hosting/edge boundary. Do not replace this with per-process memory limits.
6. Configure CSP, HSTS, framing, referrer, permissions, and content-type
   headers using the installed Next.js 16 documentation, then verify them on
   successful and error responses in the deployed environment.
7. Configure privacy-safe logs, error tracking, alerting, health/readiness
   checks, stale-content scheduling, backups, restore tests, and rollback
   ownership.
8. Run PostgreSQL/PostgREST integration tests for migrations, RLS, RPCs,
   publication, archiving, audit events, and concurrent updates.
9. Add deployed-browser E2E, axe, screen-reader, 200% zoom, narrow viewport,
   clipboard, print, offline, and blocked-IndexedDB validation.
10. Independently verify official source URLs, excerpts, licenses, effective
    dates, and reviewer approvals. No factual claims should be inferred from
    fixture records.

## Local release check

```bash
npm ci
npm run validate
```

The full check is required. A dependency-free governance test run or offline
static inspection is not release evidence.
