# Medication Travel Compliance Web App QA Test Plan

## Purpose

This QA test plan defines how the medication travel compliance MVP will be validated across functionality, accessibility, security, privacy, performance, content quality, and release readiness.

## Test Objectives

* Confirm users can build a route, add optional medicine categories, view guidance, generate a screenshot card, and save/delete locally.
* Confirm official guidance is source-backed and social listening is separated.
* Confirm sensitive medication information is not logged, tracked, or stored server-side in MVP.
* Confirm the core flow is accessible and usable on mobile and desktop.
* Confirm admin content publishing is protected and auditable.

## Test Environments

### Local

* Developer testing with seeded sample data.
* Unit and integration tests.
* Local accessibility checks.

### Staging

* Full QA with staging database.
* Seeded airports, jurisdictions, medication categories, and sample guidance.
* Staging analytics and error tracking.

### Production

* Smoke testing only after deploy.
* No destructive admin/content tests unless using test records.

## Test Data

Minimum seeded test routes:

* JFK → LHR → DXB
* LAX → NRT
* SFO → CDG → FCO
* ORD → YYZ

Minimum seeded categories:

* General guidance only.
* Controlled substance.
* Injectable.
* Liquid over 100 mL.
* Refrigerated medicine.
* Pseudoephedrine.
* Cannabis-derived.
* Unknown.

Minimum content states:

* Published high-confidence country guidance.
* Published airport-specific screening note.
* Draft guidance.
* Stale guidance.
* Guidance requiring verification.
* Published social summary.

## Functional Test Cases

### Route Builder

| ID | Scenario | Expected Result |
| --- | --- | --- |
| QA-001 | Search by IATA code JFK | JFK result appears with city and country |
| QA-002 | Search by city with multiple airports | Multiple options appear clearly |
| QA-003 | Add origin, destination, and layover | Route preview shows ordered stops |
| QA-004 | Reorder layover | Route order updates correctly |
| QA-005 | Remove stop | Stop is removed and route remains valid |
| QA-006 | Continue without destination | Error summary and inline error appear |
| QA-007 | Unknown airport query | Helpful no-results message appears |

### Trip Dates

| ID | Scenario | Expected Result |
| --- | --- | --- |
| QA-010 | Add departure and return date | Duration is calculated |
| QA-011 | Return date before departure | Error shown; cannot continue until corrected |
| QA-012 | Skip dates | User can continue with general guidance |
| QA-013 | Long trip duration | Quantity verification warning appears |

### Medicine Input

| ID | Scenario | Expected Result |
| --- | --- | --- |
| QA-020 | Skip medicine entry | General route guidance is generated |
| QA-021 | Add medicine category without name | Category-based guidance works |
| QA-022 | Add raw medicine name locally | Name appears in local UI but is not sent to analytics/logs |
| QA-023 | Select controlled substance | High-risk or documentation guidance appears where seeded |
| QA-024 | Select injectable and liquid | Screening and documentation reminders appear |
| QA-025 | Select unknown | Results recommend official verification |

### Guidance Results

| ID | Scenario | Expected Result |
| --- | --- | --- |
| QA-030 | Generate guidance for route with layover | Countries and transit points appear |
| QA-031 | Airport-specific note exists | Airport note supplements country baseline |
| QA-032 | Draft guidance exists | Draft guidance does not appear publicly |
| QA-033 | Stale guidance exists | Stale record is hidden or flagged per policy |
| QA-034 | Source panel opened | Source URL, tier, excerpt, confidence, and last-reviewed date appear |
| QA-035 | Unknown country/category combination | Unknown label and verify CTA appear |
| QA-036 | High-risk result | Copy avoids guarantees and directs official verification |

### Social Listening

| ID | Scenario | Expected Result |
| --- | --- | --- |
| QA-040 | Published social summary exists | Appears below official guidance |
| QA-041 | Generate screenshot card | Social summary does not appear by default |
| QA-042 | Social summary shown | Clearly labeled informal, not official guidance |
| QA-043 | Unsafe social claim in test data | Claim is not displayed publicly |

### Screenshot Card

| ID | Scenario | Expected Result |
| --- | --- | --- |
| QA-050 | Generate card | Card includes route, dates, countries, actions, documents, carry-on guidance, warnings, and disclaimer |
| QA-051 | Copy card text | Clipboard receives readable plain text |
| QA-052 | Print card | Print layout is readable and excludes unnecessary UI chrome |
| QA-053 | Mobile viewport | Card is readable without horizontal scrolling |
| QA-054 | Screen reader reads card | Card content is announced in logical order |

### Local Persistence

| ID | Scenario | Expected Result |
| --- | --- | --- |
| QA-060 | Save trip locally | Trip appears in saved trips list |
| QA-061 | Refresh browser | Saved trip persists |
| QA-062 | Reopen saved trip | Saved card and guidance snapshot load |
| QA-063 | Delete saved trip | Trip is removed from IndexedDB |
| QA-064 | Clear all saved data | All local saved trips are removed |

### Admin Content Workflow

| ID | Scenario | Expected Result |
| --- | --- | --- |
| QA-070 | Unauthenticated user opens admin | Access denied or redirected to login |
| QA-071 | Researcher creates draft | Draft saved but not public |
| QA-072 | Researcher attempts publish | Publish denied without reviewer/admin role |
| QA-073 | Reviewer publishes complete record | Record becomes available in public guidance |
| QA-074 | Publish incomplete record | Validation blocks publish |
| QA-075 | Archive bad record | Record no longer appears publicly |

## Accessibility Test Plan

### Automated

* axe-core via Playwright on route builder, medicine input, results, card, saved trips, and admin login.
* Lighthouse CI for accessibility score.

### Manual

* Keyboard-only completion of route builder through card generation.
* Screen reader smoke test with VoiceOver and NVDA.
* Focus order check.
* Error summary check.
* Color contrast check.
* Reduced motion preference check.
* Zoom to 200% without content loss.

### Accessibility Acceptance Criteria

* No critical or serious automated accessibility violations.
* Core user flow can be completed without mouse.
* All fields have visible labels.
* Status/risk information is not color-only.
* Screenshot card is selectable text and screen-reader readable.

## Security and Privacy Test Plan

| ID | Scenario | Expected Result |
| --- | --- | --- |
| SEC-001 | Submit medicine name | Name is not present in analytics event payload |
| SEC-002 | Trigger guidance API error | Error trace does not include raw medicine fields |
| SEC-003 | Inspect URL after medicine entry | Medicine name is not in URL |
| SEC-004 | Inspect server logs | Logs do not contain raw medicine names or full request bodies |
| SEC-005 | Unauthenticated admin API call | 401/403 response |
| SEC-006 | Researcher calls publish endpoint | 403 response |
| SEC-007 | Invalid API payload | 400 response with safe error message |
| SEC-008 | Rate-limit exceeded | 429 response |
| SEC-009 | Feedback contains sensitive terms | Warning is shown; stored text is scrubbed where feasible |
| SEC-010 | Secret scan in CI | No committed secrets |

## Performance Test Plan

### Targets

* Landing page LCP under 2.5 seconds on mobile 4G.
* Route builder interactive under 3 seconds.
* Airport search p95 under 300ms for indexed searches.
* Cached guidance evaluation p95 under 500ms.
* Uncached guidance evaluation p95 under 1500ms.
* Card generation under 500ms client-side after results are loaded.

### Tests

* Load test airport search with common queries.
* Load test guidance evaluation with cached popular route/category sets.
* Verify bundle size and lazy-loading for source/social/admin panels.
* Run Lighthouse on mobile profile.

## Content QA Plan

For each published country or airport:

* Required fields complete.
* Source URL reachable.
* Source tier assigned correctly.
* Excerpt supports the guidance.
* Last-reviewed date present.
* Confidence assigned.
* Reviewer present.
* Social listening separate from official guidance.
* High-risk guidance includes official verification CTA.

## Regression Suite

Run before every production release:

* Route builder happy path.
* General guidance path.
* High-risk medicine category path.
* Transit route path.
* Airport-specific override path.
* Screenshot card generation.
* Local save/delete.
* Source panel.
* Social-listening separation.
* Admin auth and publish validation.
* Privacy logging test.
* Accessibility smoke test.

## Bug Severity

### Blocker

* Sensitive medicine data leaks to logs, analytics, URLs, or third parties.
* Public guidance appears without required source/reviewer controls.
* Admin publish access is unauthorized.
* Core flow cannot generate results.
* Core flow is unusable by keyboard.

### Critical

* Incorrect jurisdiction mapping for common airport.
* High-risk label missing where seeded content requires it.
* Card omits key warning or disclaimer.
* Saved trip deletion fails.

### Major

* Source panel missing metadata.
* Social summary placement confusing.
* Mobile layout has significant readability issue.

### Minor

* Cosmetic defects, non-blocking copy issues, minor spacing inconsistencies.

## Release Readiness Checklist

* All P0 functional tests pass.
* No blocker or critical bugs open.
* Accessibility smoke tests pass.
* Security/privacy tests pass.
* Performance targets met or accepted by product/engineering.
* Content QA completed for launch countries/airports.
* Monitoring dashboards and alerts active.
* Rollback plan confirmed.
* Product, engineering, and content reviewer sign off.