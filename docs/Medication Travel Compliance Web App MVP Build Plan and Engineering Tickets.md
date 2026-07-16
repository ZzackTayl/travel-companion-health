# Medication Travel Compliance Web App MVP Build Plan and Engineering Tickets

## Purpose

This document converts the PRD and technical design into a lean engineering execution plan. It is intended for developers, product/design, QA, and content collaborators building the MVP.

## Build Principles

* Mobile-first responsive web app.
* No traveler account required for MVP.
* Medication details are sensitive; prefer local storage and category flags over raw medicine names.
* Official-source guidance is the core product. Social listening is secondary and clearly separated.
* Accessibility is a release blocker, not a polish task.
* Content must be auditable before publication.

## MVP Scope

### In Scope

* Landing page and early access form.
* Route builder with airport search and layover support.
* Trip date entry.
* Optional medicine/category entry.
* Country, transit, and airport guidance evaluation.
* Source panels with confidence and last-reviewed dates.
* Screenshot-ready travel card.
* Local saved trips and delete controls.
* Basic admin/content workflow for guidance records.
* Privacy-safe analytics and feedback.

### Out of Scope for MVP

* Native mobile apps.
* User accounts and cross-device sync.
* Uploading prescriptions or doctor letters.
* Fully automated medication legality determination for all medicines globally.
* Unreviewed scraping into production guidance.
* Broader wheelchair, insurance, pharmacy, or vaccination modules unless separately approved.

## Suggested Timeline

### Phase 1: Foundation and Content Model, Week 1

* Finalize data schema.
* Seed airports, jurisdictions, and medication categories.
* Build initial route search and route resolution.
* Create content research workflow and sample guidance records.

### Phase 2: Core User Flow, Weeks 2-3

* Build route builder, dates, medicine/category input, guidance results, and screenshot card.
* Implement local persistence.
* Add source panels and disclaimers.
* Add privacy-safe analytics events.

### Phase 3: Admin, QA, and Accessibility, Week 4

* Build content admin CRUD and publish workflow.
* Complete WCAG 2.2 AA QA pass.
* Run security and privacy checks.
* Prepare beta launch monitoring.

## Epics and Tickets

### Epic 1: Application Foundation

| ID | Ticket | Priority | Acceptance Criteria |
| --- | --- | --- | --- |
| ENG-001 | Set up Next.js, TypeScript, styling, linting, test framework, and CI | P0 | App builds in CI; lint, type check, and unit test commands pass |
| ENG-002 | Configure environments and secret management | P0 | Dev, staging, and production env patterns documented; no secrets committed |
| ENG-003 | Set up database, Prisma, and migrations | P0 | Database can be migrated and seeded locally and in staging |
| ENG-004 | Add error tracking and privacy-safe analytics foundation | P0 | Sentry PII scrubbing enabled; analytics events prohibit medicine names |

### Epic 2: Data Model and Seed Data

| ID | Ticket | Priority | Acceptance Criteria |
| --- | --- | --- | --- |
| ENG-010 | Implement airport, jurisdiction, medication category, guidance, source, social summary, feedback, and admin user tables | P0 | Schema supports TDD entities and required relationships |
| ENG-011 | Seed airport and jurisdiction data | P0 | Airport search works for IATA code, airport name, city, and country |
| ENG-012 | Seed medication risk category taxonomy | P0 | Categories include controlled substance, stimulant, opioid, sedative, sleep medicine, pseudoephedrine, cannabis-derived, injectable, liquid, refrigerated, device, and unknown |
| ENG-013 | Add content workflow statuses | P0 | Draft and stale records are not shown in public results unless explicitly allowed for admin preview |

### Epic 3: Route Builder

| ID | Ticket | Priority | Acceptance Criteria |
| --- | --- | --- | --- |
| ENG-020 | Build airport search API | P0 | Returns ranked airport results; handles empty, invalid, and ambiguous queries |
| ENG-021 | Build route builder UI | P0 | User can add origin, destination, and layovers; reorder and remove stops |
| ENG-022 | Build route resolution API | P0 | Converts airport IDs into ordered countries, transit flags, and jurisdiction hierarchy |
| ENG-023 | Add trip date step | P0 | User can enter departure and optional return date; duration is calculated when possible |

### Epic 4: Medicine and Category Input

| ID | Ticket | Priority | Acceptance Criteria |
| --- | --- | --- | --- |
| ENG-030 | Build optional medicine entry UI | P0 | User can add medicine details or skip with general guidance |
| ENG-031 | Build high-risk category prompts | P0 | User can classify medicines without needing to know legal terminology |
| ENG-032 | Add privacy notice before medicine entry | P0 | UI clearly explains local storage, sensitivity, and delete controls |
| ENG-033 | Prevent raw medicine names in analytics and logs | P0 | Automated tests verify analytics payloads do not include medicine names |

### Epic 5: Guidance Evaluation

| ID | Ticket | Priority | Acceptance Criteria |
| --- | --- | --- | --- |
| ENG-040 | Build guidance evaluation API | P0 | Returns per-jurisdiction actions, risk labels, confidence, and source references |
| ENG-041 | Implement jurisdiction override logic | P0 | Country baseline is supplemented or overridden by subnational, airport/security, airline, and transit rules when available |
| ENG-042 | Implement risk label aggregation | P0 | Overall route risk reflects the highest relevant severity without overstating certainty |
| ENG-043 | Add unknown and stale-data handling | P0 | Unknown guidance prompts verification with official sources; stale records are flagged or withheld per status |

### Epic 6: Results and Screenshot Card

| ID | Ticket | Priority | Acceptance Criteria |
| --- | --- | --- | --- |
| ENG-050 | Build results page | P0 | Results show summary, country/airport sections, actions, confidence, and source panels |
| ENG-051 | Build screenshot-ready travel card | P0 | Card fits mobile screen, uses selectable text, includes route, dates, actions, documents, carry-on guidance, and verify CTA |
| ENG-052 | Add copy, print, screenshot guidance, and save locally actions | P0 | User can copy card text, print page, and save trip/card locally |
| ENG-053 | Add social-listening section placeholder or reviewed summaries | P1 | Social summaries load separately and are labeled informal; they do not appear in default screenshot card |

### Epic 7: Local Persistence

| ID | Ticket | Priority | Acceptance Criteria |
| --- | --- | --- | --- |
| ENG-060 | Implement IndexedDB saved trips | P0 | Saved trip persists after reload and includes route, dates, local medicine/category data, guidance snapshot, and card snapshot |
| ENG-061 | Build saved trips list | P0 | Returning user can reopen saved trips on same device/browser |
| ENG-062 | Build delete and clear-all controls | P0 | User can delete one saved trip or clear local data; deletion is confirmed and irreversible |

### Epic 8: Admin and Content Workflow

| ID | Ticket | Priority | Acceptance Criteria |
| --- | --- | --- | --- |
| ENG-070 | Add admin authentication and roles | P0 | Admin endpoints require authenticated user with correct role |
| ENG-071 | Build guidance editor | P1 | Researcher can create and edit guidance records with jurisdiction, category, status, confidence, and action text |
| ENG-072 | Build source evidence editor | P1 | Each guidance record can attach source URL, title, tier, excerpt, accessed date, and verification date |
| ENG-073 | Build publish workflow | P1 | Reviewer can publish only records with required fields and source evidence |
| ENG-074 | Build content QA dashboard | P1 | Admin can see records by country, airport, status, confidence, and last-reviewed date |

### Epic 9: Security, Privacy, and Accessibility

| ID | Ticket | Priority | Acceptance Criteria |
| --- | --- | --- | --- |
| ENG-080 | Add API validation and rate limiting | P0 | Public APIs reject invalid input and rate-limit abusive traffic |
| ENG-081 | Add structured logging with redaction | P0 | Logs include request metadata only and redact sensitive fields |
| ENG-082 | Complete WCAG 2.2 AA implementation pass | P0 | Forms, results, card, and saved trips pass automated and manual accessibility checks |
| ENG-083 | Add keyboard and screen-reader E2E tests | P0 | Playwright verifies core flow can be completed without mouse |
| ENG-084 | Add security scan and dependency monitoring | P0 | CI includes secret scan and dependency vulnerability scan |

### Epic 10: Launch Readiness

| ID | Ticket | Priority | Acceptance Criteria |
| --- | --- | --- | --- |
| ENG-090 | Configure staging and production deployments | P0 | Staging and production deploy independently with correct env vars |
| ENG-091 | Add production monitoring dashboards | P0 | Dashboards show errors, latency, search completion, card generation, and airport no-result rate |
| ENG-092 | Run beta smoke test checklist | P0 | Route builder, guidance, card, local save/delete, source panel, and admin auth pass in production |
| ENG-093 | Add launch disclaimers and privacy notice | P0 | User-facing disclaimer and privacy language appear before guidance and medicine entry |

## Definition of Done

* Code merged after review, CI passing, and no critical security findings.
* Feature has unit/integration/E2E coverage where relevant.
* Feature is accessible by keyboard and screen reader.
* No raw medication names in analytics, URLs, logs, or error breadcrumbs.
* User-facing copy avoids legal or medical guarantees.
* Content-backed features use published guidance only.
* Product/design has reviewed mobile and desktop behavior.

## Beta Release Gate

* At least one complete route can be generated from seeded content.
* All P0 tickets complete.
* Screenshot card works on mobile and desktop.
* Saved trips can be deleted.
* Admin content cannot be accessed without authorization.
* Accessibility smoke test passes.
* Privacy review confirms medication names are local-first and not logged.
* Monitoring and rollback plan are active.