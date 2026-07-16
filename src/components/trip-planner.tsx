"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AirportSearch } from "@/components/airport-search";
import type { Airport } from "@/lib/airports";
import {
  evaluateTrip,
  medicationCategories,
  riskContent,
  type Evaluation,
  type MedicationCategory,
} from "@/lib/guidance";
import {
  clearSavedTrips,
  deleteSavedTrip,
  getSavedTrips,
  saveTrip,
  type SavedTrip,
} from "@/lib/trip-storage";

type Step = "route" | "dates" | "medicine" | "results";

const steps: { id: Step; label: string }[] = [
  { id: "route", label: "Route" },
  { id: "dates", label: "Dates" },
  { id: "medicine", label: "Medicine" },
  { id: "results", label: "Guidance" },
];

function formatDate(date: string) {
  if (!date) {
    return "Dates not added";
  }

  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(new Date(`${date}T00:00:00Z`));
}

function getDuration(departureDate: string, returnDate: string) {
  if (!departureDate || !returnDate) {
    return null;
  }

  const departure = new Date(`${departureDate}T00:00:00Z`).getTime();
  const returning = new Date(`${returnDate}T00:00:00Z`).getTime();

  return Math.round((returning - departure) / 86_400_000) + 1;
}

function routeLabel(route: Airport[]) {
  return route.map((airport) => airport.code).join(" → ");
}

function getCardText(
  route: Airport[],
  departureDate: string,
  returnDate: string,
  evaluation: Evaluation,
) {
  const risk = riskContent[evaluation.overallRisk];
  const actions = Array.from(
    new Set(evaluation.results.flatMap((result) => result.actions)),
  );

  return [
    "MEDICATION TRAVEL CARD",
    routeLabel(route),
    returnDate
      ? `${formatDate(departureDate)} – ${formatDate(returnDate)}`
      : formatDate(departureDate),
    "",
    `${risk.label}: ${risk.description}`,
    "",
    "PACK AND PREPARE",
    ...actions.map((action) => `• ${action}`),
    "",
    `Checked: ${evaluation.results
      .map(
        (result) =>
          `${result.airport.country}${result.transitOnly ? " (transit)" : ""}`,
      )
      .join(", ")}`,
    "Informational only. Verify official rules for high-risk medicines.",
  ].join("\n");
}

export function TripPlanner() {
  const [step, setStep] = useState<Step>("route");
  const [origin, setOrigin] = useState<Airport | null>(null);
  const [destination, setDestination] = useState<Airport | null>(null);
  const [layovers, setLayovers] = useState<(Airport | null)[]>([]);
  const [departureDate, setDepartureDate] = useState("");
  const [returnDate, setReturnDate] = useState("");
  const [medicineName, setMedicineName] = useState("");
  const [categories, setCategories] = useState<MedicationCategory[]>([]);
  const [evaluation, setEvaluation] = useState<Evaluation | null>(null);
  const [routeErrors, setRouteErrors] = useState<{
    origin?: string;
    destination?: string;
    layovers?: string;
  }>({});
  const [dateError, setDateError] = useState("");
  const [savedTrips, setSavedTrips] = useState<SavedTrip[]>([]);
  const [savedTripId, setSavedTripId] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const stepHeadingRef = useRef<HTMLHeadingElement>(null);
  const hasMounted = useRef(false);

  const route = useMemo(
    () =>
      [origin, ...layovers, destination].filter(
        (airport): airport is Airport => airport !== null,
      ),
    [destination, layovers, origin],
  );
  const duration = getDuration(departureDate, returnDate);
  const hasDuplicate =
    new Set(route.map((airport) => airport.id)).size < route.length;
  const currentStepIndex = steps.findIndex(({ id }) => id === step);

  useEffect(() => {
    getSavedTrips()
      .then(setSavedTrips)
      .catch(() =>
        setStatus("Saved trips are unavailable in this browser session."),
      );
  }, []);

  useEffect(() => {
    if (!hasMounted.current) {
      hasMounted.current = true;
      return;
    }

    stepHeadingRef.current?.focus();
  }, [step]);

  function validateRoute() {
    const nextErrors: typeof routeErrors = {};

    if (!origin) {
      nextErrors.origin = "Choose an origin airport from the search results.";
    }
    if (!destination) {
      nextErrors.destination =
        "Choose a destination airport from the search results.";
    }
    if (layovers.some((layover) => !layover)) {
      nextErrors.layovers = "Choose an airport or remove the empty layover.";
    }

    setRouteErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  function clearRouteError(field: keyof typeof routeErrors) {
    setRouteErrors((current) => {
      const next = { ...current };
      delete next[field];
      return next;
    });
  }

  function continueFromRoute() {
    if (validateRoute()) {
      setStep("dates");
      setStatus("");
    }
  }

  function continueFromDates() {
    if (!departureDate && returnDate) {
      setDateError("Add a departure date before adding a return date.");
      return;
    }

    if (
      departureDate &&
      returnDate &&
      new Date(returnDate) < new Date(departureDate)
    ) {
      setDateError("Return date must be on or after the departure date.");
      return;
    }

    setDateError("");
    setStep("medicine");
  }

  function generateGuidance() {
    if (!validateRoute()) {
      setStep("route");
      return;
    }

    setEvaluation(evaluateTrip(route, categories, duration));
    setStep("results");
    setStatus("Guidance generated from the reviewed demo source set.");
  }

  function toggleCategory(category: MedicationCategory) {
    setCategories((current) =>
      current.includes(category)
        ? current.filter((value) => value !== category)
        : [...current, category],
    );
  }

  function moveLayover(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= layovers.length) {
      return;
    }

    setLayovers((current) => {
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  async function refreshSavedTrips() {
    setSavedTrips(await getSavedTrips());
  }

  async function handleSave() {
    if (!evaluation) {
      return;
    }

    const now = new Date().toISOString();
    const id = savedTripId ?? crypto.randomUUID();
    const existing = savedTrips.find((trip) => trip.id === id);
    const trip: SavedTrip = {
      id,
      route,
      departureDate,
      returnDate,
      medicineName,
      categories,
      evaluation,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };

    try {
      await saveTrip(trip);
      setSavedTripId(id);
      await refreshSavedTrips();
      setStatus("Trip saved on this device/browser.");
    } catch {
      setStatus("We couldn’t save this trip in your browser.");
    }
  }

  function openSavedTrip(trip: SavedTrip) {
    setOrigin(trip.route[0] ?? null);
    setDestination(trip.route.at(-1) ?? null);
    setLayovers(trip.route.slice(1, -1));
    setDepartureDate(trip.departureDate);
    setReturnDate(trip.returnDate);
    setMedicineName(trip.medicineName);
    setCategories(trip.categories);
    setEvaluation(trip.evaluation);
    setSavedTripId(trip.id);
    setRouteErrors({});
    setDateError("");
    setStep("results");
    setStatus("Saved guidance opened. Check review dates before travel.");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleDelete(id: string) {
    if (!window.confirm("Delete this saved trip? This cannot be undone.")) {
      return;
    }

    await deleteSavedTrip(id);
    if (savedTripId === id) {
      setSavedTripId(null);
    }
    await refreshSavedTrips();
    setStatus("Saved trip deleted.");
  }

  async function handleClearAll() {
    if (
      savedTrips.length === 0 ||
      !window.confirm("Delete all saved trips? This cannot be undone.")
    ) {
      return;
    }

    await clearSavedTrips();
    setSavedTripId(null);
    await refreshSavedTrips();
    setStatus("All saved trips deleted.");
  }

  async function copyCard() {
    if (!evaluation) {
      return;
    }

    try {
      await navigator.clipboard.writeText(
        getCardText(route, departureDate, returnDate, evaluation),
      );
      setStatus("Travel card copied.");
    } catch {
      setStatus("Copy is unavailable. Select the card text to copy it.");
    }
  }

  function refreshGuidance() {
    setEvaluation(evaluateTrip(route, categories, duration));
    setStatus("Guidance refreshed from the current reviewed demo source set.");
  }

  return (
    <div className="mx-auto max-w-7xl">
      <header className="print:hidden">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-300">
          Private trip check
        </p>
        <h1 className="mt-3 max-w-3xl text-3xl font-semibold tracking-tight text-white sm:text-5xl">
          Build your route. Get a calmer medication checklist.
        </h1>
        <p className="mt-4 max-w-3xl text-base leading-7 text-slate-300 sm:text-lg">
          We’ll check your origin, destination, and layovers. Transit countries
          can matter. This demo uses a small reviewed source set and is not
          legal or medical advice.
        </p>
      </header>

      <nav aria-label="Trip check progress" className="mt-8 print:hidden">
        <ol className="grid grid-cols-4 gap-2">
          {steps.map((item, index) => (
            <li key={item.id}>
              <button
                type="button"
                disabled={index > currentStepIndex || item.id === "results"}
                onClick={() => setStep(item.id)}
                aria-current={item.id === step ? "step" : undefined}
                className={`min-h-12 w-full rounded-xl border px-2 py-3 text-xs font-semibold transition sm:text-sm ${
                  item.id === step
                    ? "border-cyan-300 bg-cyan-300/15 text-cyan-100"
                    : index < currentStepIndex
                      ? "border-white/15 bg-white/10 text-white hover:bg-white/15"
                      : "border-white/10 bg-white/5 text-slate-500"
                }`}
              >
                <span className="block text-[10px] uppercase tracking-wider sm:inline">
                  {index + 1}
                </span>{" "}
                {item.label}
              </button>
            </li>
          ))}
        </ol>
      </nav>

      <p className="sr-only" role="status" aria-live="polite">
        {status}
      </p>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] print:block">
        <div>
          {step === "route" ? (
            <section
              aria-labelledby="route-heading"
              className="rounded-3xl border border-white/10 bg-white/5 p-5 shadow-2xl shadow-slate-950/30 sm:p-8"
            >
              <div>
                <p className="text-sm font-medium text-cyan-300">Step 1 of 4</p>
                <h2
                  id="route-heading"
                  ref={stepHeadingRef}
                  tabIndex={-1}
                  className="mt-1 text-2xl font-semibold text-white"
                >
                  Where are you flying?
                </h2>
              </div>

              {Object.keys(routeErrors).length > 0 ? (
                <div
                  role="alert"
                  className="mt-5 rounded-xl border border-rose-300/30 bg-rose-300/10 p-4 text-sm text-rose-100"
                >
                  Check the highlighted route fields before continuing.
                </div>
              ) : null}

              <div className="mt-6 space-y-5">
                <AirportSearch
                  label="Origin airport"
                  airport={origin}
                  error={routeErrors.origin}
                  onSelect={(airport) => {
                    setOrigin(airport);
                    if (airport) {
                      clearRouteError("origin");
                    }
                  }}
                />

                {layovers.map((layover, index) => (
                  <div
                    key={`layover-${index}`}
                    className="rounded-2xl border border-white/10 bg-slate-950/40 p-4"
                  >
                    <AirportSearch
                      label={`Layover ${index + 1}`}
                      airport={layover}
                      error={!layover ? routeErrors.layovers : undefined}
                      onSelect={(airport) => {
                        const nextLayovers = layovers.map((value, itemIndex) =>
                          itemIndex === index ? airport : value,
                        );
                        setLayovers(nextLayovers);
                        if (nextLayovers.every(Boolean)) {
                          clearRouteError("layovers");
                        }
                      }}
                    />
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={index === 0}
                        aria-label={`Move layover ${index + 1} earlier`}
                        onClick={() => moveLayover(index, -1)}
                        className="min-h-11 rounded-lg border border-white/15 px-3 text-sm text-slate-200 transition hover:bg-white/10 disabled:opacity-40"
                      >
                        Move up
                      </button>
                      <button
                        type="button"
                        disabled={index === layovers.length - 1}
                        aria-label={`Move layover ${index + 1} later`}
                        onClick={() => moveLayover(index, 1)}
                        className="min-h-11 rounded-lg border border-white/15 px-3 text-sm text-slate-200 transition hover:bg-white/10 disabled:opacity-40"
                      >
                        Move down
                      </button>
                      <button
                        type="button"
                        aria-label={`Remove layover ${index + 1}`}
                        onClick={() => {
                          const nextLayovers = layovers.filter(
                            (_, itemIndex) => itemIndex !== index,
                          );
                          setLayovers(nextLayovers);
                          if (nextLayovers.every(Boolean)) {
                            clearRouteError("layovers");
                          }
                        }}
                        className="min-h-11 rounded-lg border border-rose-300/25 px-3 text-sm text-rose-200 transition hover:bg-rose-300/10"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}

                <button
                  type="button"
                  onClick={() => setLayovers((current) => [...current, null])}
                  className="min-h-12 rounded-xl border border-dashed border-cyan-300/40 px-4 py-3 font-semibold text-cyan-200 transition hover:bg-cyan-300/10"
                >
                  + Add a layover
                </button>

                <AirportSearch
                  label="Destination airport"
                  airport={destination}
                  error={routeErrors.destination}
                  onSelect={(airport) => {
                    setDestination(airport);
                    if (airport) {
                      clearRouteError("destination");
                    }
                  }}
                />
              </div>

              {hasDuplicate ? (
                <p className="mt-5 rounded-xl border border-amber-300/30 bg-amber-300/10 p-4 text-sm text-amber-100">
                  This route includes the same airport more than once. That’s
                  allowed, but check that it is intentional.
                </p>
              ) : null}

              <div className="mt-8 flex justify-end">
                <button
                  type="button"
                  onClick={continueFromRoute}
                  className="min-h-12 rounded-full bg-cyan-300 px-6 py-3 font-semibold text-slate-950 transition hover:bg-cyan-200"
                >
                  Continue to dates
                </button>
              </div>
            </section>
          ) : null}

          {step === "dates" ? (
            <section
              aria-labelledby="dates-heading"
              className="rounded-3xl border border-white/10 bg-white/5 p-5 shadow-2xl shadow-slate-950/30 sm:p-8"
            >
              <p className="text-sm font-medium text-cyan-300">Step 2 of 4</p>
              <h2
                id="dates-heading"
                ref={stepHeadingRef}
                tabIndex={-1}
                className="mt-1 text-2xl font-semibold text-white"
              >
                When are you traveling?
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-300">
                Dates help flag quantity limits. You can skip them for general
                guidance.
              </p>

              {dateError ? (
                <p
                  role="alert"
                  className="mt-5 rounded-xl border border-rose-300/30 bg-rose-300/10 p-4 text-sm text-rose-100"
                >
                  {dateError}
                </p>
              ) : null}

              <div className="mt-6 grid gap-5 sm:grid-cols-2">
                <label className="text-sm font-semibold text-slate-100">
                  Departure date
                  <input
                    type="date"
                    value={departureDate}
                    onChange={(event) => {
                      setDepartureDate(event.target.value);
                      setDateError("");
                      if (!event.target.value) {
                        setReturnDate("");
                      }
                    }}
                    className="mt-2 min-h-12 w-full rounded-xl border border-white/15 bg-slate-950/70 px-4 py-3 text-base text-white outline-none focus:border-cyan-300 focus:ring-2 focus:ring-cyan-300/20"
                  />
                </label>
                <label className="text-sm font-semibold text-slate-100">
                  Return date <span className="text-slate-400">(optional)</span>
                  <input
                    type="date"
                    value={returnDate}
                    min={departureDate || undefined}
                    disabled={!departureDate}
                    onChange={(event) => {
                      setReturnDate(event.target.value);
                      setDateError("");
                    }}
                    className="mt-2 min-h-12 w-full rounded-xl border border-white/15 bg-slate-950/70 px-4 py-3 text-base text-white outline-none focus:border-cyan-300 focus:ring-2 focus:ring-cyan-300/20 disabled:cursor-not-allowed disabled:opacity-50"
                  />
                </label>
              </div>

              {duration && duration > 0 ? (
                <div className="mt-5 rounded-xl border border-white/10 bg-slate-950/50 p-4 text-sm text-slate-200">
                  Trip length: <strong>{duration} days</strong>
                  {duration > 30 ? (
                    <span className="mt-2 block text-amber-200">
                      Longer trips may need quantity-limit verification or prior
                      permission.
                    </span>
                  ) : null}
                </div>
              ) : null}

              <div className="mt-8 flex flex-wrap justify-between gap-3">
                <button
                  type="button"
                  onClick={() => setStep("route")}
                  className="min-h-12 rounded-full border border-white/15 px-5 py-3 font-semibold text-slate-100 transition hover:bg-white/10"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={continueFromDates}
                  className="min-h-12 rounded-full bg-cyan-300 px-6 py-3 font-semibold text-slate-950 transition hover:bg-cyan-200"
                >
                  {departureDate ? "Continue" : "Skip dates"}
                </button>
              </div>
            </section>
          ) : null}

          {step === "medicine" ? (
            <section
              aria-labelledby="medicine-heading"
              className="rounded-3xl border border-white/10 bg-white/5 p-5 shadow-2xl shadow-slate-950/30 sm:p-8"
            >
              <p className="text-sm font-medium text-cyan-300">Step 3 of 4</p>
              <h2
                id="medicine-heading"
                ref={stepHeadingRef}
                tabIndex={-1}
                className="mt-1 text-2xl font-semibold text-white"
              >
                Add optional medicine context
              </h2>
              <div className="mt-5 rounded-xl border border-cyan-300/25 bg-cyan-300/10 p-4 text-sm leading-6 text-cyan-50">
                <strong>Privacy note:</strong> Medicine details can be
                sensitive. Names are optional and never used in guidance
                evaluation. If you save this trip, details stay in this
                device/browser and can be deleted anytime.
              </div>

              <label className="mt-6 block text-sm font-semibold text-slate-100">
                Medicine name{" "}
                <span className="font-normal text-slate-400">
                  (optional, local only)
                </span>
                <input
                  type="text"
                  value={medicineName}
                  onChange={(event) => setMedicineName(event.target.value)}
                  className="mt-2 min-h-12 w-full rounded-xl border border-white/15 bg-slate-950/70 px-4 py-3 text-base text-white outline-none focus:border-cyan-300 focus:ring-2 focus:ring-cyan-300/20"
                />
              </label>

              <fieldset className="mt-7">
                <legend className="text-base font-semibold text-white">
                  Which categories or handling needs apply?
                </legend>
                <p className="mt-1 text-sm text-slate-400">
                  Category selection is enough for a general risk screen.
                </p>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {medicationCategories.map((category) => (
                    <label
                      key={category.value}
                      className="flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border border-white/10 bg-slate-950/40 px-4 py-3 text-sm text-slate-200 transition hover:border-cyan-300/40"
                    >
                      <input
                        type="checkbox"
                        checked={categories.includes(category.value)}
                        onChange={() => toggleCategory(category.value)}
                        className="size-5 accent-cyan-300"
                      />
                      {category.label}
                    </label>
                  ))}
                </div>
              </fieldset>

              <div className="mt-8 flex flex-wrap justify-between gap-3">
                <button
                  type="button"
                  onClick={() => setStep("dates")}
                  className="min-h-12 rounded-full border border-white/15 px-5 py-3 font-semibold text-slate-100 transition hover:bg-white/10"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={generateGuidance}
                  className="min-h-12 rounded-full bg-cyan-300 px-6 py-3 font-semibold text-slate-950 transition hover:bg-cyan-200"
                >
                  {categories.length > 0
                    ? "Check my route"
                    : "Get general guidance"}
                </button>
              </div>
            </section>
          ) : null}

          {step === "results" && evaluation ? (
            <div className="space-y-6">
              <section
                aria-labelledby="results-heading"
                className="rounded-3xl border border-white/10 bg-white/5 p-5 shadow-2xl shadow-slate-950/30 sm:p-8 print:hidden"
              >
                <p className="text-sm font-medium text-cyan-300">Step 4 of 4</p>
                <h2
                  id="results-heading"
                  ref={stepHeadingRef}
                  tabIndex={-1}
                  className="mt-1 text-2xl font-semibold text-white"
                >
                  Guidance for {routeLabel(route)}
                </h2>
                <div
                  className={`mt-5 rounded-2xl border p-5 ${riskContent[evaluation.overallRisk].styles}`}
                >
                  <p className="text-sm font-semibold uppercase tracking-wider">
                    Overall route check
                  </p>
                  <h3 className="mt-2 text-xl font-semibold">
                    {riskContent[evaluation.overallRisk].label}
                  </h3>
                  <p className="mt-2 text-sm leading-6">
                    {riskContent[evaluation.overallRisk].description}
                  </p>
                </div>

                <div className="mt-7 space-y-4">
                  {evaluation.results.map((result, index) => (
                    <article
                      key={`${result.airport.id}-${index}`}
                      className="rounded-2xl border border-white/10 bg-slate-950/50 p-5"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-sm text-slate-400">
                            {result.airport.code} · {result.airport.city}
                          </p>
                          <h3 className="mt-1 text-lg font-semibold text-white">
                            {result.airport.country}
                          </h3>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {result.transitOnly ? (
                            <span className="rounded-full border border-white/15 px-3 py-1 text-xs font-semibold text-slate-200">
                              Transit stop
                            </span>
                          ) : null}
                          <span
                            className={`rounded-full border px-3 py-1 text-xs font-semibold ${riskContent[result.risk].styles}`}
                          >
                            {riskContent[result.risk].label}
                          </span>
                        </div>
                      </div>
                      <ul className="mt-4 space-y-2 text-sm leading-6 text-slate-300">
                        {result.actions.map((action) => (
                          <li key={action} className="flex gap-2">
                            <span aria-hidden="true" className="text-cyan-300">
                              ✓
                            </span>
                            <span>{action}</span>
                          </li>
                        ))}
                      </ul>
                      <details className="mt-5 border-t border-white/10 pt-4">
                        <summary className="min-h-11 cursor-pointer py-2 text-sm font-semibold text-cyan-200">
                          Official source and review details
                        </summary>
                        <div className="mt-2 text-sm leading-6 text-slate-300">
                          <p>
                            Confidence: {result.confidence} · Reviewed{" "}
                            {formatDate(result.reviewedAt)}
                          </p>
                          <a
                            href={result.source.url}
                            target="_blank"
                            rel="noreferrer"
                            className="mt-2 inline-flex min-h-11 items-center font-semibold text-cyan-200 underline decoration-cyan-300/40 underline-offset-4 hover:text-cyan-100"
                          >
                            {result.source.title}
                          </a>
                        </div>
                      </details>
                    </article>
                  ))}
                </div>
              </section>

              <article
                id="travel-card"
                aria-labelledby="travel-card-heading"
                className="travel-card mx-auto max-w-md rounded-[2rem] border border-cyan-300/30 bg-slate-900 p-6 shadow-2xl shadow-cyan-950/30 sm:p-7 print:max-w-none print:border-0 print:bg-white print:text-slate-950 print:shadow-none"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300 print:text-slate-600">
                      Medication travel card
                    </p>
                    <h2
                      id="travel-card-heading"
                      className="mt-2 text-2xl font-semibold text-white print:text-slate-950"
                    >
                      {routeLabel(route)}
                    </h2>
                    <p className="mt-1 text-sm text-slate-300 print:text-slate-700">
                      {returnDate
                        ? `${formatDate(departureDate)} – ${formatDate(returnDate)}`
                        : formatDate(departureDate)}
                    </p>
                  </div>
                  <span
                    className={`rounded-full border px-3 py-1 text-xs font-semibold ${riskContent[evaluation.overallRisk].styles} print:border-slate-400 print:bg-white print:text-slate-900`}
                  >
                    {riskContent[evaluation.overallRisk].label}
                  </span>
                </div>

                <div className="mt-6 border-t border-white/10 pt-5 print:border-slate-300">
                  <h3 className="font-semibold text-white print:text-slate-950">
                    Pack and prepare
                  </h3>
                  <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-300 print:text-slate-800">
                    {Array.from(
                      new Set(
                        evaluation.results.flatMap((result) => result.actions),
                      ),
                    )
                      .slice(0, 5)
                      .map((action) => (
                        <li key={action} className="flex gap-2">
                          <span aria-hidden="true" className="text-cyan-300">
                            ✓
                          </span>
                          <span>{action}</span>
                        </li>
                      ))}
                  </ul>
                </div>

                <div className="mt-5 rounded-xl bg-white/5 p-4 text-xs leading-5 text-slate-300 print:border print:border-slate-300 print:bg-white print:text-slate-700">
                  <strong className="text-white print:text-slate-950">
                    Countries checked:
                  </strong>{" "}
                  {evaluation.results
                    .map(
                      (result) =>
                        `${result.airport.country}${result.transitOnly ? " (transit)" : ""}`,
                    )
                    .join(", ")}
                  <span className="mt-2 block">
                    Informational only. Verify official rules for high-risk
                    medicines before travel.
                  </span>
                </div>
              </article>

              <div className="flex flex-wrap justify-center gap-3 print:hidden">
                <button
                  type="button"
                  onClick={copyCard}
                  className="min-h-12 rounded-full border border-white/15 px-5 py-3 font-semibold text-slate-100 transition hover:bg-white/10"
                >
                  Copy card
                </button>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="min-h-12 rounded-full border border-white/15 px-5 py-3 font-semibold text-slate-100 transition hover:bg-white/10"
                >
                  Print card
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  className="min-h-12 rounded-full bg-cyan-300 px-5 py-3 font-semibold text-slate-950 transition hover:bg-cyan-200"
                >
                  {savedTripId ? "Update saved trip" : "Save to this device"}
                </button>
                {savedTripId ? (
                  <button
                    type="button"
                    onClick={refreshGuidance}
                    className="min-h-12 rounded-full border border-white/15 px-5 py-3 font-semibold text-slate-100 transition hover:bg-white/10"
                  >
                    Refresh guidance
                  </button>
                ) : null}
              </div>

              <button
                type="button"
                onClick={() => setStep("route")}
                className="mx-auto flex min-h-11 items-center text-sm font-semibold text-cyan-200 underline decoration-cyan-300/40 underline-offset-4 print:hidden"
              >
                Edit trip details
              </button>
            </div>
          ) : null}
        </div>

        <aside className="space-y-5 print:hidden">
          <section className="rounded-2xl border border-white/10 bg-slate-900/70 p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
              Route preview
            </p>
            {route.length > 0 ? (
              <ol className="mt-4 space-y-3">
                {route.map((airport, index) => (
                  <li key={`${airport.id}-${index}`} className="flex gap-3">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-cyan-300/15 text-xs font-bold text-cyan-200">
                      {index + 1}
                    </span>
                    <div>
                      <p className="font-semibold text-white">
                        {airport.code} · {airport.city}
                      </p>
                      <p className="text-xs text-slate-400">
                        {airport.country}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="mt-3 text-sm leading-6 text-slate-400">
                Your selected airports will appear here.
              </p>
            )}
          </section>

          <section className="rounded-2xl border border-white/10 bg-slate-900/70 p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                  Saved on this device/browser
                </p>
                <h2 className="mt-1 font-semibold text-white">Saved trips</h2>
              </div>
              {savedTrips.length > 0 ? (
                <button
                  type="button"
                  onClick={handleClearAll}
                  className="min-h-11 text-xs font-semibold text-rose-200 underline underline-offset-4"
                >
                  Clear all
                </button>
              ) : null}
            </div>
            {savedTrips.length > 0 ? (
              <ul className="mt-4 space-y-3">
                {savedTrips.map((trip) => (
                  <li
                    key={trip.id}
                    className="rounded-xl border border-white/10 bg-white/5 p-3"
                  >
                    <button
                      type="button"
                      onClick={() => openSavedTrip(trip)}
                      className="min-h-11 w-full text-left"
                    >
                      <span className="block font-semibold text-white">
                        {routeLabel(trip.route)}
                      </span>
                      <span className="mt-1 block text-xs text-slate-400">
                        {formatDate(trip.departureDate)} ·{" "}
                        {riskContent[trip.evaluation.overallRisk].label}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(trip.id)}
                      className="mt-2 min-h-11 text-xs font-semibold text-rose-200 underline underline-offset-4"
                    >
                      Delete
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm leading-6 text-slate-400">
                Save a result to reopen it after a reload. Clearing browser data
                may remove saved trips.
              </p>
            )}
          </section>

          {status ? (
            <div
              role="status"
              className="rounded-xl border border-cyan-300/25 bg-cyan-300/10 p-4 text-sm leading-6 text-cyan-50"
            >
              {status}
            </div>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
