# Medication Travel Compliance Web App UX Flow Specification

## Purpose

This document specifies the end-to-end user experience for the medication travel compliance MVP. It is intended for product design, engineering, QA, and accessibility review.

## UX Principles

* Mobile-first, desktop-friendly.
* Calm, plain-language guidance for anxious or high-cognitive-load users.
* Ask only for information needed to generate useful guidance.
* Make medicine entry optional.
* Keep official guidance visually distinct from social-listening context.
* Make uncertainty explicit and actionable.
* Design for screen readers, keyboard navigation, low vision, motor disabilities, and cognitive accessibility from the start.

## Primary User Flows

1. Visitor joins early access from landing page.
2. Traveler builds a route and receives general guidance.
3. Traveler builds a route, adds medicine categories, and receives tailored guidance.
4. Traveler generates and saves a screenshot-ready card.
5. Returning traveler reopens or deletes a locally saved trip.
6. Content reviewer creates, reviews, and publishes guidance.

## Public App Information Architecture

* Home / Landing
* Start Trip Check
* Route Builder
* Trip Dates
* Medicine Details Optional
* Results
* Screenshot Card
* Saved Trips
* Privacy / Disclaimer
* Feedback

## Flow 1: Landing Page to Early Access

### Entry Point

User arrives from organic search, social referral, clinician referral, or direct link.

### Steps

1. User reads hero: “Travel with meds confidently.”
2. User sees product promise: route-specific medication preparation guidance.
3. User sees trust note: official sources first, anecdotes separate, not legal or medical advice.
4. User clicks Join early access.
5. User enters email, optional route/destination, and optional top concern.
6. User submits and sees confirmation.

### Acceptance Criteria

* Medication names are not requested on landing page.
* CTA is visible above the fold on mobile and desktop.
* Form fields have labels, errors, and success states.
* Confirmation explains what happens next.

## Flow 2: Route Builder

### Goal

Collect the airports or locations in the user’s itinerary and identify all relevant jurisdictions.

### Steps

1. User taps Start trip check.
2. App explains: “We’ll check your origin, destination, and layovers. Transit countries can matter.”
3. User enters origin airport.
4. User enters destination airport.
5. User adds optional layovers.
6. App shows route preview.
7. User confirms route.

### Required UI Elements

* Airport autocomplete supporting IATA code, airport name, city, and country.
* Add layover button.
* Reorder stop control.
* Remove stop control.
* Route preview with airport code, city, and country.
* Continue button.

### Empty and Error States

* No search results: “We couldn’t find that airport. Try the airport code, city, or country.”
* Ambiguous city: show multiple airport choices.
* Missing origin/destination: inline error and top error summary.
* Duplicate route stop: allow if intentional but warn if likely mistake.

### Accessibility Requirements

* Autocomplete must be keyboard accessible.
* Search results must announce count to screen readers.
* Selected airports must be readable as list items.
* Reorder controls must have accessible labels.

## Flow 3: Trip Dates

### Goal

Estimate trip duration and flag quantity-limit relevance.

### Steps

1. User enters departure date.
2. User optionally enters return date.
3. App calculates duration if both dates are present.
4. User continues or skips dates.

### Required UI Elements

* Date inputs with accessible labels.
* Skip for now option.
* Duration note when possible.

### Error States

* Return date before departure date.
* Invalid date format.
* Very long trip warning: “Longer trips may need quantity-limit verification or prior permission.”

## Flow 4: Medicine Details Optional

### Goal

Let users add medicine context while respecting privacy.

### Steps

1. App shows privacy notice: “Medicine details can be sensitive. For MVP, saved trip details stay on this device unless you choose to share feedback.”
2. User chooses:
  * Add medicines for more tailored guidance.
  * Skip medicine names and get general route guidance.
3. If adding medicines, user enters optional name and selects categories/special handling.
4. User repeats for multiple medicines.
5. User continues to results.

### Medicine Fields

* Medicine name optional.
* Generic name optional.
* Prescription or OTC.
* Dosage form.
* Supply duration or quantity optional.
* Category prompts:
  * Controlled substance.
  * ADHD stimulant.
  * Opioid.
  * Sedative/anxiety medication.
  * Sleep medication.
  * Pseudoephedrine.
  * Cannabis-derived product.
  * Injectable.
  * Liquid over 100 mL.
  * Refrigerated medicine.
  * Needles/sharps.
  * Medical device.
  * Not sure.

### UX Rules

* Do not force users to enter medicine names.
* Explain that category selection can be enough for general risk screening.
* Do not shame or alarm users; use measured risk language.
* Avoid autocomplete suggestions that imply legal status unless verified.

## Flow 5: Results

### Goal

Present route-specific official guidance, source confidence, and next actions.

### Page Structure

1. Top summary.
2. Overall risk label.
3. Action checklist.
4. Per-country and transit sections.
5. Airport/security notes.
6. Source panel.
7. Social-listening summary separated below official guidance.
8. Screenshot card CTA.
9. Save trip CTA.
10. Feedback prompt.

### Risk Label Language

* Likely OK: “No major issue found in reviewed guidance. Still carry documents and verify if your medicine is high-risk.”
* Check documentation: “Bring prescription copies, original packaging, or a doctor letter.”
* Prior permission may be required: “Check official requirements before travel.”
* High risk: “Do not travel with this item until you verify official rules.”
* Unknown: “We could not verify this confidently. Check official sources before travel.”

### Per-Jurisdiction Card Content

* Country or airport name.
* Transit-only badge if applicable.
* Risk label.
* Required actions.
* Documentation guidance.
* Packaging guidance.
* Quantity notes.
* Screening/declaration notes.
* Confidence score.
* Last-reviewed date.
* Source links.

### Social Listening Placement

* Below official guidance.
* Heading: “Recent traveler reports, informal context.”
* Label: “Not official guidance.”
* Show themes, recency, volume, and confidence.
* Do not include in default screenshot card.

## Flow 6: Screenshot-Ready Travel Card

### Goal

Create a compact, mobile-friendly summary the user can screenshot, copy, print, or save locally.

### Card Content

* Trip route and dates.
* Countries and transit points checked.
* Top risk label.
* Pack this way.
* Bring these documents.
* Carry-on and screening reminders.
* Quantity or prior-permission warnings.
* High-risk verification CTA.
* Last-reviewed date and source confidence summary.
* Disclaimer: informational, verify official rules for high-risk medicines.

### Design Requirements

* Fits within a typical mobile viewport where possible.
* Uses large, readable text.
* Uses text and icons, not color alone.
* Selectable text, not image-only.
* Works with browser screenshot, print, and copy.
* Includes accessible heading and section structure.

### Actions

* Copy card text.
* Print card.
* Save to this device.
* Return to detailed results.

## Flow 7: Saved Trips

### Goal

Let users return to prior guidance without an account.

### Steps

1. Returning user sees Saved trips link or prompt.
2. User opens saved trip list.
3. User selects trip.
4. App shows saved card and option to refresh guidance.
5. User can delete trip.

### UX Notes

* Clearly label: “Saved on this device/browser.”
* Warn that clearing browser storage may remove saved trips.
* If guidance is stale or last-reviewed date is old, show refresh prompt.

## Flow 8: Feedback

### Goal

Collect user confidence and product feedback without sensitive data capture.

### Fields

* Confidence rating: 1-5.
* Was this useful? Yes/no.
* Optional feedback text.

### Privacy Copy

“Please avoid entering medication names, diagnosis details, passport numbers, or other sensitive personal information.”

## Admin UX Flow

### Researcher

1. Logs in.
2. Creates draft guidance record.
3. Selects jurisdiction and medication category.
4. Adds summary, action text, risk label, and confidence.
5. Adds source record with URL, tier, excerpt, and accessed date.
6. Submits for review.

### Reviewer

1. Opens review queue.
2. Checks evidence and required fields.
3. Requests changes or publishes.
4. Published record becomes available to public guidance API.

## Desktop Behavior

* Use two-column layouts where helpful.
* Route builder and medicine input can appear on left; preview or checklist on right.
* Results can show sidebar navigation for countries and sections.
* Screenshot card should still preview mobile dimensions, with copy/print controls nearby.

## Accessibility Requirements

* WCAG 2.2 AA target.
* Semantic headings in logical order.
* Every input has a visible label.
* Error summary at top plus inline errors.
* Keyboard-only operation for all flows.
* Visible focus states.
* Minimum 44px touch targets.
* Status updates announced through appropriate live regions.
* Reduced motion support.
* Color contrast meets AA minimums.
* Plain-language copy and short paragraphs.

## Analytics Events

* landing_viewed
* early_access_started
* early_access_submitted
* route_started
* airport_selected
* layover_added
* route_resolved
* dates_added
* medicine_flow_started
* medicine_category_selected
* medicine_flow_skipped
* guidance_generated
* source_panel_opened
* social_summary_opened
* screenshot_card_generated
* card_copied
* card_printed
* trip_saved_local
* trip_deleted_local
* feedback_submitted

Do not include medication names, free-text medicine fields, diagnosis details, or personally identifying route notes in analytics properties.

## UX Open Questions

* Whether to call the screenshot artifact “Travel Card,” “Medication Travel Card,” or “Trip Med Card.”
* Whether saved trips should expire by default after the trip ends.
* Whether to show the social-listening module in MVP or behind a feature flag.
* Whether to add a “clinician checklist” export later.