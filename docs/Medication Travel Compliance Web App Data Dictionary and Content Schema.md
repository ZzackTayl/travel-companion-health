# Medication Travel Compliance Web App Data Dictionary and Content Schema

## Purpose

This document defines the core data entities, field meanings, validation rules, and content schema needed to build the medication travel compliance MVP. It should be used by engineers, researchers, data modelers, and content reviewers.

## Design Goals

* Support route-specific guidance across countries, airports, transit points, and optional medication categories.
* Preserve source evidence and content review history.
* Allow jurisdiction-specific overrides without hard-coding every exception.
* Keep sensitive traveler medication data local whenever possible.
* Separate official guidance from anecdotal social-listening summaries.

## Entity Overview

| Entity | Purpose | Storage |
| --- | --- | --- |
| Airport | Searchable airport metadata and jurisdiction mapping | Server database |
| Jurisdiction | Country, region, city, airport authority, airline, or transit node | Server database |
| MedicationCategory | Risk categories used for guidance matching | Server database |
| GuidanceRecord | Published or draft recommendation tied to jurisdiction and category | Server database |
| SourceRecord | Evidence supporting a guidance record | Server database |
| SocialSummary | Moderated anecdotal theme summary | Server database |
| AnonymousFeedback | Privacy-safe feedback and confidence rating | Server database |
| AdminUser | Researcher/reviewer/admin access | Server database |
| SavedTrip | User route, categories, card, and result snapshot | Client IndexedDB |

## Enumerations

### JurisdictionType

* country
* region
* city
* airport_authority
* airline
* transit

### GuidanceType

* general
* packaging
* documentation
* quantity_limit
* prohibited
* restricted
* screening
* declaration
* transit
* airline_carriage

### RiskLabel

* likely_ok
* check_documentation
* prior_permission_may_be_required
* high_risk
* unknown

### Confidence

* official_verified
* high
* medium
* low
* unknown

### ContentStatus

* draft
* reviewed
* published
* stale
* archived
* needs_verification

### SourceType

* government
* embassy
* customs
* health_authority
* aviation_authority
* airport
* airline
* incb
* cdc
* tsa
* trusted_secondary
* social

### VolumeBucket

* low
* moderate
* high

## Airport

Represents an airport available for route search and jurisdiction mapping.

| Field | Type | Required | Validation / Notes |
| --- | --- | --- | --- |
| id | string | Yes | UUID or CUID |
| iataCode | string | Conditional | 3 uppercase letters; unique when present |
| icaoCode | string | No | 4 uppercase letters |
| name | string | Yes | Official or commonly used airport name |
| city | string | Yes | Primary city served |
| countryCode | string | Yes | ISO 3166-1 alpha-2 |
| regionCode | string | No | ISO 3166-2 when useful |
| latitude | decimal | No | For future map display |
| longitude | decimal | No | For future map display |
| active | boolean | Yes | Defaults true |
| createdAt | datetime | Yes | System generated |
| updatedAt | datetime | Yes | System generated |

Indexes:

* iataCode unique.
* countryCode.
* city.
* Full-text or trigram index on name, city, iataCode, and country.

## Jurisdiction

Represents legal, regulatory, airport, or airline scope.

| Field | Type | Required | Validation / Notes |
| --- | --- | --- | --- |
| id | string | Yes | UUID or CUID |
| type | JurisdictionType | Yes | Determines hierarchy behavior |
| name | string | Yes | User-readable name |
| countryCode | string | Yes | ISO country code |
| code | string | No | Region, airport, airline, or authority code |
| parentId | string | No | References parent jurisdiction |
| priority | integer | Yes | Higher specificity wins in override logic |
| active | boolean | Yes | Defaults true |
| createdAt | datetime | Yes | System generated |
| updatedAt | datetime | Yes | System generated |

Recommended priority:

* country: 10
* region: 20
* city: 30
* airport_authority: 40
* airline: 50
* transit: contextual flag, not always higher than airport/security

## MedicationCategory

Normalized risk categories used by the rules engine. The app should not rely on raw medicine names in MVP.

| Field | Type | Required | Validation / Notes |
| --- | --- | --- | --- |
| id | string | Yes | UUID or CUID |
| slug | string | Yes | Unique machine-readable key |
| label | string | Yes | User-facing label |
| description | string | Yes | Plain-language explanation |
| riskLevelDefault | string | Yes | low, medium, high, unknown |
| userPrompt | string | No | Prompt shown in medicine flow |
| examples | array | No | Examples should be generic and avoid implying legal status |
| active | boolean | Yes | Defaults true |

Initial category slugs:

* prescription
* over_the_counter
* controlled_substance
* opioid
* stimulant_adhd
* sedative_anxiety
* sleep_medication
* pseudoephedrine
* cannabis_derived
* injectable
* liquid_over_100ml
* refrigerated
* medical_device
* needles_or_sharps
* unknown

## GuidanceRecord

Core content object returned to users.

| Field | Type | Required | Validation / Notes |
| --- | --- | --- | --- |
| id | string | Yes | UUID or CUID |
| jurisdictionId | string | Yes | FK to Jurisdiction |
| medicationCategoryId | string | No | Null means general guidance |
| guidanceType | GuidanceType | Yes | Determines where guidance appears |
| riskLabel | RiskLabel | Yes | User-facing risk label |
| title | string | Yes | Short heading |
| summary | text | Yes | Plain-language explanation |
| actionText | text | Yes | Direct action for user |
| appliesToTransit | boolean | Yes | Whether transit travelers should consider it |
| effectiveFrom | date | No | If source gives start date |
| effectiveTo | date | No | If source gives end date |
| status | ContentStatus | Yes | Only published records appear publicly |
| confidence | Confidence | Yes | Based on source quality and specificity |
| lastReviewedAt | datetime | Conditional | Required for published records |
| reviewerId | string | Conditional | Required for published records |
| createdAt | datetime | Yes | System generated |
| updatedAt | datetime | Yes | System generated |

Validation rules:

* Published records require at least one SourceRecord.
* Published records require lastReviewedAt and reviewerId.
* High-risk or unknown records should include a verify-with-official-source action.
* Draft, archived, and needs_verification records must not appear in public guidance responses.

## SourceRecord

Evidence source attached to a guidance record.

| Field | Type | Required | Validation / Notes |
| --- | --- | --- | --- |
| id | string | Yes | UUID or CUID |
| guidanceRecordId | string | Yes | FK to GuidanceRecord |
| url | string | Yes | Valid URL |
| title | string | Yes | Source title |
| sourceType | SourceType | Yes | Used for tiering |
| qualityTier | integer | Yes | 1-4 |
| excerpt | text | Yes | Relevant excerpt supporting guidance |
| publishedAt | date | No | If available |
| accessedAt | datetime | Yes | When researcher accessed source |
| lastVerifiedAt | datetime | No | When reviewer last verified source |
| notes | text | No | Internal notes |

Validation rules:

* Excerpt must be specific enough to support the guidance.
* Social source records should not be attached as official evidence for guidance unless labeled as Tier 4 context only.

## SocialSummary

Moderated summary of anecdotal traveler reports. This is not official guidance.

| Field | Type | Required | Validation / Notes |
| --- | --- | --- | --- |
| id | string | Yes | UUID or CUID |
| jurisdictionId | string | Yes | FK to Jurisdiction |
| medicationCategoryId | string | No | Null if general travel theme |
| summary | text | Yes | Theme-based summary, not individual claims |
| themes | json | Yes | Array of labels/counts/examples without private info |
| sourceTypes | json | Yes | Example: Reddit, public forums, travel blogs |
| sampleWindowStart | date | Yes | Start of reviewed period |
| sampleWindowEnd | date | Yes | End of reviewed period |
| volumeBucket | VolumeBucket | Yes | low/moderate/high |
| confidence | Confidence | Yes | Usually low or medium |
| status | ContentStatus | Yes | Published only after review |
| reviewedAt | datetime | Conditional | Required for published |
| reviewerId | string | Conditional | Required for published |

Rules:

* Must be displayed separately from official guidance.
* Must not appear in default screenshot card.
* Must not include usernames, private data, or unsafe instructions.

## AnonymousFeedback

Privacy-safe user feedback for product improvement.

| Field | Type | Required | Validation / Notes |
| --- | --- | --- | --- |
| id | string | Yes | UUID or CUID |
| routeHash | string | No | Hash only; avoid raw route if possible |
| riskLabel | RiskLabel | No | Overall result label |
| confidenceRating | integer | No | 1-5 |
| feedbackText | text | No | Scrub for PII and medication names where feasible |
| createdAt | datetime | Yes | System generated |

## AdminUser

Internal access for content workflow.

| Field | Type | Required | Validation / Notes |
| --- | --- | --- | --- |
| id | string | Yes | UUID or auth provider ID |
| email | string | Yes | Unique |
| role | string | Yes | admin, researcher, reviewer |
| createdAt | datetime | Yes | System generated |
| lastLoginAt | datetime | No | Updated by auth system |

Role behavior:

* Researcher can draft records.
* Reviewer can review and publish.
* Admin can manage roles and archive content.

## Client-Side SavedTrip

Stored in IndexedDB on the user’s device/browser.

| Field | Type | Required | Validation / Notes |
| --- | --- | --- | --- |
| id | string | Yes | Client-generated UUID |
| routeStops | array | Yes | Airport IDs and display labels |
| dates | object | No | departureDate and returnDate |
| medications | array | No | Local-only names and category flags |
| evaluatedGuidanceSnapshot | object | Yes | Last generated guidance result |
| travelCardSnapshot | object | Yes | Card data for offline reference |
| createdAt | datetime | Yes | Client generated |
| updatedAt | datetime | Yes | Client generated |
| expiresAt | datetime | No | Optional future auto-delete |

Privacy rules:

* Do not sync to server in MVP.
* Provide delete and clear-all controls.
* Explain that local browser/device storage may be accessible to others using the same device profile.

## Guidance Evaluation Payload

### Request

```json
{
  "routeStopIds": \["airport_jfk", "airport_lhr"\],
  "departureDate": "2026-05-12",
  "returnDate": "2026-05-22",
  "medicationCategories": \["controlled_substance", "injectable"\]
}

```

Do not include raw medication names unless a future consent model is implemented.

### Response

```json
{
  "overallRisk": "check_documentation",
  "jurisdictions": \[
    {
      "jurisdictionId": "jur_gb",
      "name": "United Kingdom",
      "countryCode": "GB",
      "airportCodes": \["LHR"\],
      "transitOnly": true,
      "riskLabel": "check_documentation",
      "actions": \["Carry prescription copies", "Keep medicines in original packaging"\],
      "confidence": "medium",
      "lastReviewedAt": "2026-03-01T00:00:00Z",
      "sources": \["src_123"\]
    }
  \]
}

```

## Data Governance Rules

* Public guidance endpoints return only published records.
* Every published record must have source evidence and reviewer metadata.
* Medication names are not stored server-side in MVP.
* Analytics properties must use categories and risk labels only.
* Social listening must not alter official risk labels without reviewer action and official evidence.
* Stale records should be flagged for review and either hidden or labeled depending on content policy.

## Open Data Model Decisions

* Whether to store routeHash for analytics or avoid route-level persistence entirely.
* Whether to add versioning tables for guidance records in MVP or use status/archive fields until scale requires full versioning.
* Whether to support airline-specific guidance in v1 or reserve schema support only.
* Whether to add country-specific medication name aliases after manual review.