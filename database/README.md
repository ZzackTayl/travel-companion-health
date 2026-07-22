# Governed guidance database

Apply every file in `migrations/` in numeric order before applying
`seeds/launch_coverage.sql`. Migration `002_security_hardening.sql` repairs the
authenticated audit-trigger boundary and freezes reviewed candidates before
publication.

The migration provides:

- append-only source evidence and auditable guidance status changes;
- database-enforced publication requirements for review metadata, current
  evidence, lower-tier approval, uncertainty language, and stale dates;
- a public read view that withholds non-published, stale, and out-of-date
  guidance;
- explicit launch coverage requirements for the seeded MVP routes; and
- `mark_stale_guidance()`, which should run on a scheduled database job.

`DatabaseGuidanceRepository` uses a PostgREST-compatible PostgreSQL API. Public
reads use the public key. Draft creation, evidence insertion, publication, and
coverage reporting require the signed-in admin's access token. Publication is
performed by a database RPC that derives the reviewer from that token; callers
cannot supply or impersonate the publishing reviewer.

The launch seed intentionally contains coverage requirements, not factual
guidance. A missing requirement remains visible as a launch gap and produces an
unknown fallback until a reviewer publishes evidence-backed guidance.
