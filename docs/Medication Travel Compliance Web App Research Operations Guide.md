# Medication Travel Compliance Web App Research Operations Guide

## Purpose

This guide defines how researchers, AI agents, and reviewers collect, verify, summarize, and publish medication travel guidance for countries, airports, transit points, medication categories, and social-listening context.

## Research Principles

* Official sources are primary.
* Country and airport rules can change; every record needs a last-reviewed date.
* Airport-specific or subnational guidance should only override national guidance when supported by credible evidence.
* Social listening is useful context, not authority.
* When evidence is incomplete, the product should say unknown and direct users to official verification.
* Never present legal or medical certainty unless an official source explicitly supports the statement.

## Source Quality Tiers

| Tier | Source Type | Examples | Usage |
| --- | --- | --- | --- |
| 1 | National government, customs, health, embassy, aviation/security authority, INCB, CDC Yellow Book, TSA for U.S. screening | Official customs pages, embassy medication pages, INCB country guidance | Can support published guidance |
| 2 | Official airport, airline, or airport security operator pages | Airport medical liquids page, airline medical device policy | Can support airport/security or airline-specific guidance |
| 3 | Trusted secondary guidance | Travel health clinics, government-backed travel advisories, recognized medical travel resources | Use when Tier 1/2 is missing; requires reviewer caution |
| 4 | Social listening and anecdotes | Reddit, forums, travel groups, personal blogs, reviews | Never official guidance; theme summary only |

## Jurisdiction Research Hierarchy

Research in this order:

1. Country-level law or national guidance.
2. Subnational rules where applicable: state, province, region, territory.
3. City or local rules if official evidence shows relevance.
4. Airport or aviation security authority guidance.
5. Airline carriage rules if the route or medical item requires it.
6. Transit-specific rules.
7. Social-listening context.

## U.S. Handling

Start with federal guidance for the United States:

* TSA screening rules.
* FDA/CBP personal import guidance where relevant.
* DEA considerations for controlled substances.
* CDC/State Department outbound traveler guidance.

Add state or local overlays only when relevant and evidenced, especially for:

* Cannabis-derived products.
* Controlled substances.
* Pseudoephedrine restrictions.
* Prescribing, possession, or documentation rules.
* Airport/security-specific instructions.

Do not imply every U.S. state has different medication travel rules unless research confirms the difference matters for travelers.

## International Handling

For each non-U.S. country:

* Research national rules first.
* Check the destination embassy or consulate guidance.
* Check INCB for narcotic and psychotropic substances.
* Check airport/security authority pages for screening procedures.
* Add subnational or airport overrides only when official evidence demonstrates a difference.
* Flag transit rules separately because travelers may be subject to transit-country requirements even without leaving the airport.

## Research Workflow

### Step 1: Define Coverage Target

Create a research ticket with:

* Country or airport.
* Priority routes or airport pairs.
* Medication categories to evaluate.
* Deadline and reviewer.
* Known high-risk topics.

### Step 2: Collect Official Sources

For each target, search official sources first:

* National customs or health authority.
* Embassy or consulate pages.
* INCB controlled substance guidance.
* Aviation/security authority.
* Airport official site.
* Airline policy if relevant.

Capture source URL, title, publishing date if available, accessed date, and relevant excerpt.

### Step 3: Extract Structured Guidance

Convert source evidence into structured fields:

* Allowed, restricted, prohibited, unknown, or documentation required.
* Medication categories affected.
* Quantity limit or supply duration.
* Packaging requirement.
* Prescription copy requirement.
* Doctor letter or medical certificate requirement.
* Prior permission or permit requirement.
* Declaration or screening steps.
* Transit applicability.
* Airline or airport-specific notes.

### Step 4: Identify Exceptions and Overrides

Check whether any rule varies by:

* Region, state, province, or territory.
* City or local authority.
* Airport or airport security authority.
* Airline.
* Medication category.
* Traveler status, such as resident, visitor, transit passenger, or long-stay traveler.

### Step 5: Assign Confidence

Use this model:

* Official verified: clear Tier 1 source, directly applicable, recent or still-current.
* High: Tier 1 or 2 source with clear guidance, minor ambiguity.
* Medium: credible source but incomplete, indirect, or older; reviewer judgment required.
* Low: limited evidence, conflicting guidance, or only secondary sources.
* Unknown: insufficient reliable evidence.

### Step 6: Draft User-Facing Guidance

Write in plain language:

* What to do.
* Why it matters.
* Who it applies to.
* What to verify.
* What source supports it.

Avoid definitive promises such as “you will be allowed through customs.” Use “official guidance says,” “may require,” and “verify before travel” where appropriate.

### Step 7: Perform Social Listening

Use social listening to identify themes only.

Sources may include:

* Reddit travel and chronic illness communities.
* Travel forums.
* Disability travel communities.
* Public social posts.
* App/site feedback after launch.

Capture:

* Theme.
* Jurisdiction or airport.
* Medication category if relevant.
* Recency window.
* Volume bucket: low, moderate, high.
* Whether reports conflict with official guidance.

Exclude:

* Private or doxxing information.
* Medical/legal advice.
* Claims encouraging concealment or evasion.
* Single unsupported anecdotes presented as facts.

### Step 8: Reviewer QA

Reviewer checks:

* Source quality tier is correct.
* Excerpts support the user-facing summary.
* Guidance status and confidence are appropriate.
* Required fields are populated.
* Social listening is separated from official guidance.
* Disclaimers are present for high-risk or uncertain guidance.

### Step 9: Publish or Flag

Publish only when acceptance criteria are met. Otherwise mark as:

* Draft.
* Needs source verification.
* Needs legal/clinical review.
* Stale.
* Not enough evidence.

## Required Fields Per Country or Airport

| Field | Required for Publish | Notes |
| --- | --- | --- |
| Jurisdiction name and code | Yes | Country, region, city, airport code |
| Guidance scope | Yes | Country, airport, transit, airline, category |
| Risk label | Yes | likely OK, check documentation, prior permission may be required, high risk, unknown |
| Packaging guidance | Yes | Include original labeled container guidance when supported |
| Documentation guidance | Yes | Prescription, doctor letter, certificate, permit |
| Quantity guidance | If available | Use unknown if not found |
| Screening/declaration steps | If available | Especially liquids, injectables, devices |
| Source URL and excerpt | Yes | At least one strong source or reviewer-approved fallback |
| Source tier | Yes | 1-4 |
| Last reviewed date | Yes | Required for published records |
| Confidence | Yes | official verified, high, medium, low, unknown |
| Reviewer | Yes | Named internal reviewer/admin |
| Unresolved questions | If any | Must be surfaced or resolved |

## Publish Acceptance Criteria

A country or airport is ready to publish when:

* Required fields are complete.
* At least one Tier 1 or Tier 2 source supports the guidance, or a reviewer approves a carefully labeled lower-confidence record.
* Source excerpts directly support the summary.
* Last-reviewed date is recorded.
* Confidence score is assigned.
* Conflicts are documented and either resolved or shown to users as uncertainty.
* Social-listening content is separate and labeled informal.
* No guidance implies legal or medical guarantee.

## Review Cadence

* High-risk countries/categories: every 30-60 days.
* Common routes and high-traffic airports: every 60-90 days.
* Lower-traffic guidance: every 180 days.
* Immediately review any user report, source change, or known regulatory update affecting restrictions.

## AI Agent Instructions

When using an AI research agent:

* Start with official sources; do not begin with social media.
* Cite every claim with source URL and excerpt.
* Identify whether the source applies to origin, destination, transit, airport screening, or airline carriage.
* Separate facts from recommendations.
* Mark uncertainty explicitly.
* Do not scrape or store private user posts.
* Do not auto-publish AI outputs without human review.

## Research Output Format

Each research task should produce:

* Executive summary.
* Jurisdictions covered.
* Medication categories covered.
* Structured guidance fields.
* Source table.
* Confidence assessment.
* Social-listening themes, if researched.
* Open questions.
* Publish recommendation.

## Escalation Triggers

Escalate to product, legal, clinical, or senior reviewer if:

* A medication appears prohibited or could create criminal/legal risk.
* Official sources conflict.
* Guidance involves controlled substances, cannabis, narcotics, psychotropics, injectables, or large quantities.
* Source evidence is unavailable but user demand is high.
* Social anecdotes indicate repeated incidents not reflected in official guidance.

## Research Governance Metrics

Track:

* Countries and airports published.
* Records by confidence level.
* Records approaching stale date.
* Records without Tier 1/2 support.
* User reports requiring review.
* Social-listening summaries reviewed.
* Average time from research start to publish.