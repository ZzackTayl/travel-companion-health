## Product Overview

Context for the technical design.

### Purpose

* Solve the uncertainty travelers face when carrying prescription, OTC, controlled, injectable, liquid, or refrigerated medicines across international routes.
* Convert a traveler’s route, dates, and optional medication details into jurisdiction-specific preparation guidance, source-backed recommendations, and a screenshot-ready travel card.
* Support a research-governed content model where official guidance is prioritized, airport-specific rules can override generic guidance, and social-listening summaries remain clearly separated from authoritative guidance.

Key scenarios:

* A traveler flying JFK → LHR → DXB enters medicines and receives country and transit guidance with documentation reminders.
* A caregiver creates a locally saved preparation card for a family member without creating an account.
* A traveler with injectables or medical liquids receives screening, declaration, carry-on, and documentation reminders.
* A content reviewer updates country or airport guidance with source URLs, last-reviewed dates, confidence scores, and publication status.

### Target Audience

* International travelers carrying prescription or OTC medicines who need clear, route-specific preparation steps.
* Travelers with chronic conditions, disabilities, or medical supplies who need accessible, low-stress planning.
* Caregivers supporting another traveler’s medication preparation.
* Internal content researchers and reviewers responsible for maintaining official-source guidance.

The product addresses their pain points by reducing multi-source research burden, surfacing transit risks, making uncertainty explicit, and producing a mobile-friendly card that can be saved, copied, printed, or screenshotted.

### Expected Outcomes

* Tangible benefits:
  * Faster itinerary-to-guidance completion.
  * Higher confidence before departure.
  * Reusable saved trip cards without requiring an account.
  * Auditable research workflow for country, airport, and medication category guidance.
* Intangible benefits:
  * Reduced anxiety around customs and airport screening.
  * Increased trust through source transparency and cautious language.
  * Inclusive access for travelers using assistive technologies.
* KPIs:
  * Search completion rate.
  * Screenshot card generation rate.
  * Source-link click-through rate for high-risk routes.
  * Local saved-trip return rate.
  * User confidence rating after viewing results.
  * Lighthouse accessibility score of 95+ on core pages.
* Short-term impact:
  * Validate demand with a privacy-conscious web MVP and curated initial country/airport dataset.
* Long-term impact:
  * Build a trusted health-travel guidance platform that can expand into mobility aids, medical devices, travel insurance, pharmacy/refill planning, and vaccination document modules.

## Architecture

The structural design of the system.

### High-Level Architecture

Recommended MVP stack:

* Frontend: Next.js 15 with React, TypeScript, App Router, Tailwind CSS, and shadcn/ui-style accessible primitives.
* Backend: Next.js API routes or a lightweight NestJS service if separating API from web becomes necessary.
* Database: PostgreSQL hosted on Supabase or Neon for guidance, airports, jurisdictions, medications taxonomy, source records, and content workflow.
* ORM: Prisma for type-safe schema access and migrations.
* Local persistence: IndexedDB via Dexie.js for saved trips and travel cards; localStorage only for non-sensitive UI preferences.
* Search: PostgreSQL full-text search for MVP; add Meilisearch or Typesense later if airport/medication search grows.
* Cache: Vercel Edge Cache for read-heavy guidance endpoints; Redis later for high-traffic API caching.
* External services:
  * Static airport dataset seeded from an open IATA/ICAO airport database and reviewed for accuracy.
  * Official source URLs curated by researchers rather than scraped into user guidance without review.
  * Optional future social-listening provider or manually moderated ingestion workflow.
* Hosting: Vercel for frontend/API MVP; Supabase/Neon for managed PostgreSQL.
* Analytics: PostHog with privacy-safe event names and no medication names in event properties.
* Error tracking: Sentry with PII scrubbing enabled.

Communication protocols:

* Browser → App/API: HTTPS REST endpoints returning JSON.
* App/API → PostgreSQL: TLS-secured database connection through Prisma.
* Browser local storage: IndexedDB API; no network call required for saved-card retrieval.
* Future live alerts: Web Push or email, only after account/consent model exists.

Design patterns:

* Modular monolith for MVP to reduce complexity.
* Server-side rendering for landing and static content pages.
* Client-side state machine for the trip builder flow.
* Rules-engine pattern for combining itinerary, medication categories, jurisdiction hierarchy, and guidance records.
* Repository/service pattern for guidance lookup, rule evaluation, and card generation.
* Content workflow state machine for draft, reviewed, published, stale, and archived guidance.

### Data Structures & Algorithms

Core data structures:

* Route graph/list: Ordered array of route stops. A list is sufficient because the user flow is sequential by itinerary leg.
* Jurisdiction tree: Country → state/province/region → city/local → airport/security authority → airline notes. Used for override resolution.
* Medication category set: Set of normalized risk categories per user-entered medicine, such as controlled substance, stimulant, sedative, opioid, pseudoephedrine, cannabis-derived, injectable, liquid, refrigerated, medical device, or unknown.
* Guidance rule records: Structured rows keyed by jurisdiction, medication category, and guidance type.
* Source evidence records: Append-only source references with quality tier, excerpt, URL, and review metadata.
* Confidence score: Categorical enum plus numeric support if needed: low, medium, high, official-verified.

Key algorithms:

* Airport resolution:
  * Input: IATA code, airport name, city, or country.
  * Output: airport entity and mapped jurisdiction.
  * Approach: exact IATA match first, then ranked text search over name/city/country.
  * Complexity: O(log n) for indexed exact lookup; O(k log n) or database-ranked search for fuzzy queries.
* Route jurisdiction expansion:
  * Input: ordered airports.
  * Output: unique ordered jurisdictions and transit flags.
  * Approach: map each airport to country and airport authority; preserve order and deduplicate for summary while retaining per-leg context.
  * Complexity: O(n) route stops.
* Guidance resolution:
  * Input: route jurisdictions, medication category set, trip duration.
  * Output: per-jurisdiction guidance and risk labels.
  * Approach: query applicable guidance, then apply override priority: country baseline, subnational, local, airport/security, airline, transit notes. More specific published records override broader records when source confidence is equal or higher.
  * Complexity: O(j × c × r), where j is jurisdictions, c is categories, and r is matching rule records; bounded and cacheable.
* Card condensation:
  * Input: full results.
  * Output: screenshot-card summary.
  * Approach: deterministic prioritization: high-risk warnings, required documents, packaging, quantity limits, carry-on/screening, verify actions.
  * Complexity: O(m log m) if sorting by severity; otherwise O(m).

Scalability and performance considerations:

* Cache published guidance by route-country set and medication category set.
* Keep social-listening summaries separate from core guidance lookups to avoid slowing primary results.
* Store long source excerpts separately from compact result payloads.
* Use stale-while-revalidate for guidance that changes infrequently.
* Keep client bundle small; lazy-load social-listening and detailed source panels.

### System Interfaces

* API endpoints:
  * `GET /api/airports/search?q=`: Search airports by IATA code, name, city, or country.
  * `POST /api/routes/resolve`: Convert ordered airport IDs into route, countries, transit points, and applicable jurisdiction hierarchy.
  * `GET /api/medication-categories`: Return risk category taxonomy and user-friendly prompts.
  * `POST /api/guidance/evaluate`: Generate route-specific guidance from route, dates, and medication category flags.
  * `POST /api/cards/generate`: Return compact screenshot-card data from evaluated guidance.
  * `GET /api/social-summary?jurisdictionId=&category=`: Return moderated social-listening summary where available.
  * `GET /api/sources/:id`: Return source metadata and excerpt for a guidance item.
  * `POST /api/feedback`: Capture privacy-safe feedback and confidence rating.
  * Admin: `POST /api/admin/guidance`, `PATCH /api/admin/guidance/:id`, `POST /api/admin/guidance/:id/publish`, protected by role-based access.

Example request for guidance evaluation:

```json
{
  "routeStopIds": \["airport_jfk", "airport_lhr", "airport_dxb"\],
  "departureDate": "2026-05-12",
  "returnDate": "2026-05-22",
  "medications": \[
    {
      "clientId": "med_1",
      "displayName": "Medication hidden locally",
      "categories": \["controlled_substance", "prescription", "solid_oral"\]
    },
    {
      "clientId": "med_2",
      "categories": \["injectable", "liquid", "refrigerated"\]
    }
  \]
}

```

Example response:

```json
{
  "overallRisk": "check_documentation",
  "jurisdictions": \[
    {
      "countryCode": "GB",
      "airportCodes": \["LHR"\],
      "transitOnly": true,
      "riskLabel": "check_documentation",
      "actions": \[
        "Keep medicines in original labeled containers",
        "Carry prescription copies and a prescriber letter for controlled or injectable medicines",
        "Verify controlled-substance status with official source before departure"
      \],
      "sources": \[
        {
          "id": "src_123",
          "title": "Official travel medicine guidance",
          "qualityTier": 1,
          "lastReviewedAt": "2026-03-01"
        }
      \],
      "confidence": "medium"
    }
  \]
}

```

Third-party integrations:

* Vercel for hosting and edge caching.
* Supabase or Neon PostgreSQL for data.
* Sentry for error monitoring with PII scrubbing.
* PostHog for privacy-safe analytics.
* Optional future: social-listening API, email waitlist provider, and account authentication provider.

Internal modules:

* Airport module: search, resolution, jurisdiction mapping.
* Itinerary module: route ordering, transit detection, trip duration.
* Medication module: category prompts and local-sensitive display handling.
* Guidance module: rules lookup and override resolution.
* Source module: source confidence and review metadata.
* Card module: card summarization and export/copy formatting.
* Social module: moderated anecdote summaries.
* Admin module: content workflow and publication controls.

### User Interface

Main UI components and interaction patterns:

* Landing page: waitlist CTA, product promise, screenshot-card preview, privacy/trust notes.
* Route builder: airport autocomplete, add/remove/reorder stops, route preview.
* Trip date step: departure and optional return date with duration warning.
* Medicine input: optional medicine names, category prompts, privacy notice, skip option.
* Results page: grouped by country/airport, risk labels, action checklist, source confidence, expandable source details.
* Screenshot card: compact mobile-first card with route, countries checked, dates, required documents, packaging, carry-on rules, high-risk warnings, and verify CTA.
* Social-listening section: below official guidance, visually separated and labeled informal.
* Saved trips: local device-only list with delete controls and stale-source warnings.
* Admin content screens: guidance editor, source evidence panel, review status, publish controls.

Wireframe description:

* Mobile flow uses a single-column stepper with persistent progress and large touch targets.
* Desktop uses a two-column layout where input remains on the left and route/results preview appears on the right.
* Results page prioritizes a top summary card, then per-country accordions, then social-listening summaries.

Accessibility and responsive design approach:

* WCAG 2.2 AA target.
* Semantic HTML, labeled fields, descriptive error messages, keyboard navigation, visible focus, reduced motion support.
* Status labels include text and icons, never color alone.
* Screenshot card must be real selectable text and screen-reader readable, not image-only.
* Minimum 44px touch targets and high-contrast palettes.

## Data Model

How data is structured, stored, and accessed.

### Entities

For each core entity:

```
Airport
  - id: string (primary key, cuid/uuid)
  - iataCode: string (unique, length 3, nullable for non-IATA airports)
  - icaoCode: string (nullable)
  - name: string (required)
  - city: string (required)
  - countryCode: string (required, ISO 3166-1 alpha-2)
  - regionCode: string (nullable, ISO 3166-2 where applicable)
  - latitude: decimal (nullable)
  - longitude: decimal (nullable)
  - active: boolean (default true)

```

```
Jurisdiction
  - id: string (primary key)
  - type: enum (country, region, city, airport_authority, airline, transit)
  - name: string (required)
  - countryCode: string (required)
  - parentId: string (nullable FK to Jurisdiction)
  - priority: integer (higher specificity wins)

```

```
MedicationCategory
  - id: string (primary key)
  - slug: string (unique)
  - label: string (required)
  - description: string (required)
  - riskLevelDefault: enum (low, medium, high, unknown)
  - userPrompt: string (nullable)
  - active: boolean (default true)

```

```
GuidanceRecord
  - id: string (primary key)
  - jurisdictionId: string (FK Jurisdiction)
  - medicationCategoryId: string (FK MedicationCategory, nullable for general guidance)
  - guidanceType: enum (packaging, documentation, quantity_limit, prohibited, restricted, screening, declaration, transit, general)
  - riskLabel: enum (likely_ok, check_documentation, prior_permission_may_be_required, high_risk, unknown)
  - title: string (required)
  - summary: string (required)
  - actionText: string (required)
  - effectiveFrom: date (nullable)
  - effectiveTo: date (nullable)
  - status: enum (draft, reviewed, published, stale, archived)
  - confidence: enum (low, medium, high, official_verified)
  - lastReviewedAt: datetime (required for published)
  - reviewerId: string (nullable FK User)
  - createdAt: datetime
  - updatedAt: datetime

```

```
SourceRecord
  - id: string (primary key)
  - guidanceRecordId: string (FK GuidanceRecord)
  - url: string (required)
  - title: string (required)
  - sourceType: enum (government, embassy, aviation_authority, airport, airline, incb, cdc, tsa, trusted_secondary, social)
  - qualityTier: integer (1-4)
  - excerpt: text (required)
  - publishedAt: date (nullable)
  - accessedAt: datetime (required)
  - lastVerifiedAt: datetime (nullable)

```

```
SocialSummary
  - id: string (primary key)
  - jurisdictionId: string (FK Jurisdiction)
  - medicationCategoryId: string (FK MedicationCategory, nullable)
  - summary: text (required)
  - themes: json (array of theme labels and counts)
  - sourceTypes: json (array)
  - sampleWindowStart: date (required)
  - sampleWindowEnd: date (required)
  - volumeBucket: enum (low, moderate, high)
  - confidence: enum (low, medium, high)
  - status: enum (draft, reviewed, published, archived)
  - reviewedAt: datetime (nullable)

```

```
AnonymousFeedback
  - id: string (primary key)
  - routeHash: string (nullable)
  - riskLabel: string (nullable)
  - confidenceRating: integer (1-5, nullable)
  - feedbackText: text (nullable, PII scrubbing required)
  - createdAt: datetime

```

```
User
  - id: string (primary key)
  - email: string (unique, required for admin users)
  - role: enum (admin, researcher, reviewer)
  - createdAt: datetime
  - lastLoginAt: datetime (nullable)

```

Client-side IndexedDB objects:

```
SavedTrip
  - id: string (client-generated uuid)
  - routeStops: array (airport IDs and labels)
  - dates: object (departureDate, returnDate)
  - medications: array (optional names and category flags, stored locally only)
  - evaluatedGuidanceSnapshot: object (last generated result)
  - travelCardSnapshot: object (card data)
  - createdAt: datetime
  - updatedAt: datetime
  - expiresAt: datetime (optional user-configurable)

```

### Relationships

* Airport → Jurisdiction: many airports map to one country jurisdiction and optionally region/city/airport authority records.
* Jurisdiction → Jurisdiction: self-referential parent-child hierarchy for override resolution.
* GuidanceRecord → Jurisdiction: many guidance records belong to one jurisdiction.
* GuidanceRecord → MedicationCategory: many guidance records may target one medication category; nullable for general country guidance.
* GuidanceRecord → SourceRecord: one-to-many; each published guidance record requires source evidence.
* SocialSummary → Jurisdiction: many summaries can be associated with one jurisdiction.
* SocialSummary → MedicationCategory: optional category association.
* GuidanceRecord → User: optional reviewer relationship.
* AnonymousFeedback: intentionally not linked to user account in MVP.

### Storage

* Database technology and hosting:
  * PostgreSQL on Supabase or Neon.
  * Prisma migrations stored with the application repository.
  * Row-level security or application-level authorization for admin content operations.
* Caching strategy:
  * Vercel Edge Cache for published guidance responses.
  * HTTP cache headers for static airport search metadata where safe.
  * Future Redis cache for high-cardinality route evaluations.
* File/blob storage approach:
  * MVP should avoid storing user-uploaded files.
  * Future attachments for source screenshots or archived PDFs can use Supabase Storage or S3-compatible object storage with private access.
  * No user medication documents should be uploaded in MVP.

### Data Flow

1. User opens app and searches for airports.
2. Frontend calls airport search endpoint and receives non-sensitive airport results.
3. User builds route and optionally adds trip dates and medicine categories.
4. Medicine names remain in client state and IndexedDB unless explicit consent is added in a future version. API requests should prefer category flags over raw names.
5. Frontend sends route stop IDs, dates, and category flags to guidance evaluation endpoint.
6. Backend resolves jurisdictions, applies hierarchy and overrides, and returns published guidance with source metadata.
7. Frontend renders official guidance and lets the user expand source panels.
8. Social-listening summary is loaded separately and labeled as informal context.
9. User generates screenshot card; frontend condenses server result plus local route/medicine context into a readable card.
10. User saves the trip locally in IndexedDB or deletes it from the device.

## Testing Plan

How the product will be validated at every level.

### Testing Strategy

* Unit tests:
  * Framework: Vitest.
  * Coverage target: 80%+ for rules engine, jurisdiction resolution, airport search utilities, card condensation, and privacy scrubbing utilities.
  * Test high-risk medication category mapping and override precedence.
* Integration tests:
  * Framework: Vitest with test database or Prisma test containers.
  * Validate API routes for airport search, route resolution, guidance evaluation, source retrieval, and feedback.
  * Verify unpublished/stale guidance is not returned to users.
* E2E tests:
  * Framework: Playwright.
  * Critical flows: build route, add medicine categories, view results, expand source panel, generate card, save locally, delete saved trip, keyboard-only completion.
* Accessibility tests:
  * Automated: axe-core through Playwright and Lighthouse CI.
  * Manual: screen-reader smoke tests with VoiceOver and NVDA; keyboard-only navigation; reduced motion preference.
* Performance tests:
  * k6 or Artillery for route evaluation and airport search endpoints.
  * Targets: p95 cached guidance response under 500ms; uncached guidance response under 1500ms for common routes; frontend interactive under 3s on mobile mid-tier connection.
* Security tests:
  * Dependency scanning, secret scanning, PII logging tests, auth authorization tests for admin endpoints, and OWASP Top 10 review.

### Testing Tools

* Frameworks: Vitest, React Testing Library, Playwright, axe-core, Lighthouse CI, k6 or Artillery.
* CI integration:
  * GitHub Actions runs lint, type check, unit tests, integration tests, Playwright smoke suite, and dependency scans on pull requests.
  * Full E2E and performance smoke tests run on staging before production deployment.
* Code coverage:
  * 80% line coverage for core domain modules.
  * 90% branch coverage for guidance resolution and privacy/logging utilities.
  * CI blocks merges if critical domain coverage drops below threshold.

### Key Test Cases

Critical scenarios to validate:

* Happy path:
  * User searches JFK, LHR, DXB; adds dates; selects controlled substance and injectable categories; receives per-country guidance; generates card.
* General guidance path:
  * User skips medication entry and still receives route-level packing and verification guidance.
* Transit path:
  * Layover country guidance appears and is clearly labeled transit.
* Airport-specific override:
  * Airport screening rule overrides or supplements country baseline guidance.
* U.S. state/local override:
  * Federal guidance appears first; subnational override appears only for supported categories and official evidence.
* Unknown medication/category:
  * App shows unknown status and recommends official verification without overstating certainty.
* Stale content:
  * Stale or draft guidance is excluded or flagged appropriately depending on status.
* Social listening:
  * Anecdotal summary appears below official guidance and never inside default screenshot card.
* Local persistence:
  * Saved trip persists after reload; delete removes IndexedDB records.
* Accessibility:
  * Route builder and screenshot card are usable with keyboard and screen reader.
* Security-sensitive operations:
  * Admin endpoints reject unauthenticated users and users without correct role.
  * Medication names are not sent in analytics events or logs.
* Performance under expected load:
  * 100 concurrent route evaluations remain under response targets for cached common routes.

### Reporting

* Test results are reported in GitHub Actions with pass/fail status and coverage artifacts.
* Playwright traces are retained for failed E2E tests.
* Lighthouse CI tracks accessibility, performance, and best-practices scores over time.
* Sentry tracks runtime errors with PII scrubbing.
* PostHog dashboards track funnel metrics without sensitive medication details.
* Content QA dashboard tracks countries/airports by publication status, confidence, and last-reviewed date.

## Deployment Plan

How the product moves from code to production.

### Environment Setup

* Development:
  * Node.js LTS, pnpm, local `.env`, Prisma, and local PostgreSQL via Docker or Supabase local development.
  * Seed data: sample airports, jurisdictions, medication categories, and a small guidance dataset for test routes.
  * Hot reload through Next.js dev server.
* Staging:
  * Vercel preview/staging environment connected to staging PostgreSQL.
  * Test admin users only.
  * Seeded but non-production guidance records.
  * Analytics and Sentry use staging projects.
* Production:
  * Vercel production deployment.
  * Managed PostgreSQL with automated backups and restricted access.
  * Admin access protected by MFA-capable auth provider.
  * Monitoring, error alerts, and uptime checks enabled.

### CI/CD Pipeline

* Build steps:
  * Install dependencies with lockfile validation.
  * Lint.
  * Type check.
  * Unit tests.
  * Integration tests.
  * Prisma migration validation.
  * Build Next.js app.
  * Playwright smoke tests on preview deployment.
  * Dependency and secret scanning.
* Deployment trigger:
  * Pull requests create preview deployments.
  * Merge to main deploys to staging or production depending on branch strategy.
  * Production release requires manual approval for early MVP.
* Preview deployments:
  * Every PR receives a Vercel preview URL.
  * Preview environments use sanitized seed data and no production secrets.

### Deploy Process

1. Merge approved PR to main and verify CI passes, including lint, type check, tests, build, and security scans.
2. Deploy to staging and run smoke tests for route builder, guidance results, screenshot card, saved trips, and admin login.
3. Run database migrations on staging and verify content workflow states and guidance lookup behavior.
4. Obtain product/content approval for any guidance schema or source-publishing changes.
5. Promote to production with Vercel deployment and production migration.
6. Verify production health endpoint, landing page, route builder, guidance evaluation, card generation, and analytics events.
7. Monitor Sentry, uptime checks, p95 latency, and user funnel events for the first 60 minutes.

### Rollback Strategy

* Application rollback:
  * Use Vercel instant rollback to the prior successful deployment.
* Database migration rollback:
  * Prefer backward-compatible additive migrations.
  * For destructive migrations, require backup snapshot and explicit rollback script.
  * If migration issue occurs, disable affected feature flag and roll back app before database restoration.
* Feature flags:
  * Use environment-controlled flags for social-listening display, admin publishing, experimental medication prompts, and new jurisdiction overrides.
* Content rollback:
  * Guidance records are versioned by status and updatedAt; revert by archiving faulty record and republishing prior reviewed version.

### Post-Deploy Verification

* Smoke tests:
  * Search airport by IATA code.
  * Build route with layover.
  * Generate guidance with high-risk category.
  * Generate screenshot card.
  * Save and delete local trip.
  * Open source panel.
  * Confirm social summary separation.
  * Confirm admin content pages require authentication.
* Monitoring dashboards:
  * Vercel function latency and error rate.
  * Sentry error rate and new issue count.
  * PostHog funnel: route start → results → card generation.
  * Database CPU, connection count, slow queries.
* Alert thresholds:
  * 5xx rate > 2% for 10 minutes.
  * p95 guidance evaluation > 2 seconds for 15 minutes.
  * Airport search failure rate > 3%.
  * New critical Sentry issue affecting route evaluation or card generation.
  * Unauthorized admin access attempts above baseline.

## Security & Performance

Non-functional requirements and how they are addressed.

### Security

* Authentication and authorization approach:
  * No account required for traveler MVP.
  * Admin/researcher access protected by managed auth provider, MFA-capable login, and role-based access control.
  * Server checks roles for all admin endpoints.
* Input validation and sanitization:
  * Zod schemas validate all API inputs.
  * Sanitize feedback text and source excerpts before rendering.
  * Rate-limit public endpoints to prevent abuse.
* Secrets management:
  * Store secrets in Vercel and database provider environment management.
  * Never commit `.env` files.
  * Use secret scanning in CI.
* Sensitive medication data controls:
  * Prefer sending medication categories rather than raw medicine names to the server.
  * Do not include medication names in analytics, URLs, logs, or Sentry breadcrumbs.
  * Use local IndexedDB for saved trips by default.
  * Provide visible delete controls.
* Dependency vulnerability scanning:
  * Use Dependabot or Renovate, npm audit, and GitHub CodeQL.
* OWASP Top 10 considerations relevant to this product:
  * Broken access control: strict RBAC for admin routes.
  * Cryptographic failures: TLS everywhere; no sensitive data in query strings.
  * Injection: Prisma parameterized queries and input validation.
  * Insecure design: privacy-by-default and no account requirement for MVP.
  * Security misconfiguration: separate staging/production secrets and locked CORS.
  * Vulnerable components: automated dependency updates and scans.
  * Identification/auth failures: managed auth and MFA for admins.
  * Software/data integrity failures: CI checks, lockfile validation, reviewed content publishing.
  * Logging/monitoring failures: Sentry and audit logs for admin changes, with PII scrubbing.
  * SSRF: avoid arbitrary server-side URL fetching from user input in MVP.

### Performance

* Targets:
  * Landing page LCP < 2.5s on mobile 4G.
  * App route builder interactive < 3s on mobile.
  * Airport search p95 < 300ms for indexed searches.
  * Cached guidance evaluation p95 < 500ms.
  * Uncached guidance evaluation p95 < 1500ms.
  * Throughput > 50 guidance evaluations per second for MVP launch traffic with caching.
* Optimization:
  * Server-render landing and static explanation pages.
  * Lazy-load detailed source panels, social summaries, admin UI, and noncritical visuals.
  * Use edge caching for published guidance endpoints.
  * Optimize airport search indexes on IATA code, city, country, and trigram text search if enabled.
  * Keep screenshot card client-rendered using existing result data to avoid extra round trips.
  * Use image optimization for landing page mockups.
* Monitoring:
  * Vercel Web Vitals and function metrics.
  * Sentry performance traces for guidance evaluation.
  * PostHog funnel monitoring.
  * Custom metrics for guidance cache hit rate and airport search failure rate.
* Scaling:
  * Start with managed serverless hosting and managed PostgreSQL.
  * Add Redis or dedicated search service when query volume or search latency requires it.
  * Use read replicas if guidance read traffic grows materially.
  * Keep social-listening processing asynchronous and outside the critical guidance path.

### Observability

* Logging strategy:
  * Structured JSON logs for API request ID, endpoint, status, duration, cache hit, and non-sensitive error codes.
  * Redact medication names, free-text feedback, emails, and route details where they could identify a user.
  * Retention: 30 days for application logs unless compliance review requires shorter retention.
* Metrics:
  * Route searches started/completed.
  * Guidance evaluations by risk label and confidence level.
  * Screenshot cards generated.
  * Source panels opened.
  * Local save/delete actions.
  * Airport search no-result rate.
  * Guidance records by stale/reviewed/published status.
  * Admin publication activity.
* Alerting:
  * Engineering owner receives alerts for production 5xx spikes, high latency, database connection saturation, and critical Sentry issues.
  * Product/content owner receives alerts for stale high-traffic guidance records and high unknown-rate routes.
  * Security owner receives alerts for suspicious admin login failures, rate-limit spikes, and dependency critical vulnerabilities.