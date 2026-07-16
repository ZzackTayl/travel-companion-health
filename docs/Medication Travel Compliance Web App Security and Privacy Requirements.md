# Medication Travel Compliance Web App Security and Privacy Requirements

## Purpose

This document defines security and privacy requirements for the medication travel compliance MVP. The product handles health-adjacent and potentially sensitive medication information, so privacy-by-default must be built into the architecture, UX, analytics, and operations.

## Security and Privacy Principles

* Data minimization: collect the least information required.
* Local-first: save traveler medication details on the user’s device by default.
* No account required for MVP.
* No raw medication names in analytics, URLs, logs, or error traces.
* Official guidance can be server-side; personal trip details should be minimized server-side.
* Users must be able to delete locally saved trips.
* Social listening must not expose private individuals or unsafe claims.
* Admin content publishing must be authenticated, authorized, and auditable.

## Data Classification

| Data Type | Sensitivity | Handling Requirement |
| --- | --- | --- |
| Airport search query | Low to moderate | Avoid long retention; do not tie to identity |
| Route stops | Moderate | Can be sensitive when combined with health data; avoid unnecessary persistence |
| Trip dates | Moderate | Avoid storing server-side unless needed |
| Medication category flags | Sensitive-adjacent | Send only when required for guidance; avoid analytics |
| Raw medication names | Sensitive | Local-only in MVP; never analytics/logs/URLs |
| Feedback text | Potentially sensitive | Warn users not to enter sensitive data; scrub before storage |
| Email waitlist | Personal data | Store with consent and unsubscribe/delete path |
| Admin user account | Personal and security-sensitive | Authenticated, MFA-capable, RBAC |
| Source and guidance content | Low | Auditable and version-controlled |

## MVP Privacy Requirements

### Local-First Medication Data

* Raw medicine names and user-entered medicine details should remain in browser memory or IndexedDB.
* API requests should send medication category flags instead of raw names wherever possible.
* Saved trips are stored in IndexedDB on the same device/browser.
* UI must explain that local browser storage may be visible to others using the same device profile.

### No Account Requirement

* Travelers can complete the route, guidance, card, save, and delete flows without sign-in.
* Do not introduce account creation unless cross-device sync, alerts, or premium features require it later.

### Clear User Controls

* Delete individual saved trips.
* Clear all locally saved data.
* Copy card text without uploading data.
* View privacy explanation before entering medicine details.

### Sensitive Analytics Restrictions

Analytics may include:

* Event name.
* Non-sensitive UI step.
* Risk label.
* Confidence level.
* Whether user skipped medicine entry.
* Count of categories selected, if needed.

Analytics must not include:

* Medication names.
* Diagnosis details.
* Free-text medicine notes.
* Full route plus dates plus category combination if it could identify a user.
* Email address in product analytics events.

## Security Requirements

### Transport Security

* All browser/API traffic must use HTTPS/TLS.
* HSTS should be enabled in production.
* Do not place sensitive data in URL query strings.

### API Input Validation

* Validate all inputs using strict schemas.
* Reject unknown fields where feasible.
* Limit array sizes for route stops and medication categories.
* Sanitize feedback text and content excerpts before rendering.

### Rate Limiting and Abuse Prevention

Apply rate limits to:

* Airport search.
* Route resolution.
* Guidance evaluation.
* Feedback submission.
* Waitlist submission.
* Admin login attempts through auth provider controls.

### Logging Requirements

Logs may include:

* Request ID.
* Endpoint.
* Status code.
* Duration.
* Cache hit/miss.
* Non-sensitive error codes.

Logs must not include:

* Raw medication names.
* Free-text medicine fields.
* Feedback text before scrubbing.
* Emails, unless in dedicated secure auth/audit logs.
* Full request bodies for guidance evaluation.

### Error Tracking

* Enable PII scrubbing in Sentry or equivalent.
* Remove breadcrumbs containing form values.
* Do not capture full request payloads for guidance or feedback endpoints.
* Configure alerting for security-sensitive errors.

### Admin Authentication and Authorization

* Admin, researcher, and reviewer access requires managed authentication.
* Use MFA-capable provider.
* Enforce role-based access control server-side.
* Researchers can draft, reviewers can publish, admins can manage users and archive.
* Audit log all publish, archive, and role changes.

### Database Security

* Restrict production database access to necessary services and administrators.
* Use TLS for database connections.
* Enable automated backups.
* Use separate staging and production databases.
* Avoid production data in local development.

### Content Integrity

* Public guidance endpoints return only published content.
* Publishing requires reviewer and source evidence.
* Content changes should be auditable.
* Prefer additive migrations and content rollback through archiving/republishing prior records.

### Third-Party Services

Approved MVP services may include:

* Hosting provider.
* Managed PostgreSQL provider.
* Analytics with privacy-safe configuration.
* Error tracking with PII scrubbing.
* Waitlist/email provider for landing page.

Third-party restrictions:

* Do not send raw medication names to analytics, social-listening APIs, AI APIs, or error tracking.
* Do not use user-entered medicine data to train third-party models.
* Add explicit consent before any future cloud sync or alert service.

## Social Listening Privacy Requirements

* Use public sources only.
* Summarize themes, not individual identities.
* Do not store usernames unless there is a legitimate moderation need; default to not storing them.
* Do not quote private individuals in user-facing content.
* Remove unsafe advice, legal advice, medical advice, and evasion tactics.
* Label all social-listening summaries as informal and not official guidance.

## Legal and Compliance Considerations

The MVP should be treated as health-adjacent and sensitive even if it is not a HIPAA covered entity.

Consider:

* GDPR/UK GDPR if serving users in Europe or the UK.
* CCPA/CPRA if serving California residents.
* Consumer health data laws where applicable.
* Accessibility requirements and WCAG 2.2 AA commitment.
* Clear disclaimer that the product is informational, not legal or medical advice.

## Required User-Facing Privacy Copy

Before medicine entry:

“Medication information can be sensitive. You can skip medicine names and still get general route guidance. If you save a trip in this MVP, it is saved on this device/browser so you can return later. You can delete saved trips anytime.”

Before feedback:

“Please do not include medication names, diagnosis details, passport numbers, or other sensitive personal information in feedback.”

On results:

“This guidance is informational and based on reviewed sources where available. Medication rules can change. Verify high-risk medicines with official authorities before travel.”

## Security Testing Requirements

Before beta:

* Dependency scan passes with no critical unresolved vulnerabilities.
* Secret scan passes.
* Admin endpoints reject unauthenticated requests.
* RBAC tests pass for researcher, reviewer, and admin roles.
* PII logging tests confirm medication names are not logged.
* Analytics payload tests confirm medication names are excluded.
* Rate-limit tests pass for public endpoints.
* Basic OWASP Top 10 review completed.

## Privacy Testing Requirements

Before beta:

* Raw medicine name does not leave browser in standard flow.
* Saved trip can be deleted from IndexedDB.
* Clear-all local data works.
* Refresh does not expose medicine names in URL.
* Sentry test error does not include medication form values.
* Feedback warning appears before free-text feedback.

## Incident Response Basics

If sensitive data is accidentally logged or exposed:

1. Disable affected logging or endpoint.
2. Preserve incident timeline and access logs.
3. Delete or quarantine affected logs according to provider capabilities.
4. Assess whether user notification is required.
5. Patch and add regression tests.
6. Review monitoring and access controls.

If incorrect high-risk guidance is published:

1. Archive or unpublish the record immediately.
2. Revert to prior reviewed guidance if available.
3. Add user-facing unknown/verify warning while researching.
4. Review source and reviewer workflow.
5. Add QA rule to prevent recurrence.

## Release Blockers

Do not launch beta if:

* Medication names are present in analytics, logs, URLs, or Sentry payloads.
* Admin publish endpoints can be accessed without correct role.
* Users cannot delete saved local trips.
* Results imply legal or medical certainty.
* Published guidance can appear without source evidence.
* Accessibility blocks prevent keyboard or screen-reader completion of core flow.