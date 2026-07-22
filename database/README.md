# Governed guidance database

Apply `migrations/001_governed_guidance.sql` and
`migrations/002_public_guidance_runtime.sql` to PostgreSQL, in order, before
applying `seeds/launch_coverage.sql`.

The migration provides:

- append-only source evidence and auditable guidance status changes;
- database-enforced publication requirements for review metadata, current
  evidence, lower-tier approval, uncertainty language, and stale dates;
- a protected eligibility view that withholds non-published, stale,
  out-of-date, or invalid guidance;
- explicit launch coverage requirements for the seeded MVP routes;
- `mark_stale_guidance()`, which should run on a scheduled database job;
- a bounded, kill-switch-protected public evaluation RPC that resolves exact
  route requirements by jurisdiction, category, and guidance type; and
- audited emergency controls for globally disabling evaluations and archiving
  individual revisions.

`DatabaseGuidanceRepository` uses a PostgREST-compatible PostgreSQL API. Public
reads use the public key. Draft creation, evidence insertion, publication, and
coverage reporting require the signed-in admin's access token. Publication is
performed by a database RPC that derives the reviewer from that token; callers
cannot supply or impersonate the publishing reviewer.

The application server requires `GUIDANCE_DATABASE_URL` and
`GUIDANCE_DATABASE_PUBLIC_KEY`. It calls only
`get_public_guidance_for_route(jsonb)` for consumer evaluations. Direct public
access to the governed tables and eligibility view is revoked.

Public evaluation defaults to disabled. An authenticated admin must call
`set_guidance_public_evaluation_enabled(boolean, text)` with a non-empty audit
reason after reviewed content is ready. Missing runtime state, a disabled
switch, database errors, and malformed database responses all fail closed.
Archiving a revision uses `archive_guidance(uuid, text)` and also requires an
audit reason.

The launch seed intentionally contains coverage requirements, not factual
guidance. A missing requirement remains visible as a launch gap and produces an
unknown fallback until a reviewer publishes evidence-backed guidance.
