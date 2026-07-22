"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { AirportCombobox } from "@/components/airport-combobox";
import { DurationNotice } from "@/components/duration-notice";
import { MedicineEditor } from "@/components/medicine-editor";
import { TravelCard } from "@/components/travel-card";
import type {
  Airport,
  GuidanceEvaluation,
  ResolvedRoute,
  RiskLabel,
} from "@/lib/domain";
import { getTripDuration } from "@/lib/dates";
import {
  categoryLabels,
  createLocalMedicine,
  nonEmptyMedicines,
  selectedCategories,
} from "@/lib/medicines";
import {
  clearSavedTrips,
  deleteSavedTrip,
  listSavedTrips,
  saveTrip,
  type LocalMedicine,
  type SavedTrip,
} from "@/lib/saved-trips";
import {
  buildTravelCardModel,
  formatTravelCardPlainText,
} from "@/lib/travel-card";

const riskLabels: Record<RiskLabel, string> = {
  likely_ok: "Likely OK",
  check_documentation: "Check documentation",
  prior_permission_may_be_required: "Prior permission may be required",
  high_risk: "High risk — verify before travel",
  unknown: "Not yet verified",
};

interface ApiBody {
  error?: string;
  issues?: Array<{ message: string }>;
}

async function parseResponse<T>(response: Response): Promise<T> {
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    throw new Error("The server returned an unreadable response.");
  }
  const body = (await response.json()) as ApiBody;
  if (!response.ok) {
    throw new Error(
      body.issues?.map(({ message }) => message).join(" ") ||
        body.error ||
        "The request could not be completed.",
    );
  }
  return body as T;
}

function inputKey(
  routeStops: Airport[],
  departureDate: string,
  returnDate: string,
  medicines: LocalMedicine[],
) {
  return JSON.stringify({
    routeStopIds: routeStops.map(({ id }) => id),
    departureDate,
    returnDate,
    medicationCategories: selectedCategories(medicines),
  });
}

export function TripPlanner() {
  const [routeStops, setRouteStops] = useState<Airport[]>([]);
  const [resolvedRoute, setResolvedRoute] = useState<ResolvedRoute | null>(
    null,
  );
  const [departureDate, setDepartureDate] = useState("");
  const [returnDate, setReturnDate] = useState("");
  const [medicines, setMedicines] = useState<LocalMedicine[]>([
    createLocalMedicine(),
  ]);
  const [evaluation, setEvaluation] = useState<GuidanceEvaluation | null>(null);
  const [evaluationKey, setEvaluationKey] = useState("");
  const [savedTrips, setSavedTrips] = useState<SavedTrip[]>([]);
  const [loadedTripId, setLoadedTripId] = useState<string | null>(null);
  const [isResolving, setIsResolving] = useState(false);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [error, setError] = useState("");
  const [storageError, setStorageError] = useState("");
  const [status, setStatus] = useState("");
  const [deleteConfirmation, setDeleteConfirmation] = useState<string | null>(
    null,
  );
  const [confirmClear, setConfirmClear] = useState(false);
  const routeRequestId = useRef(0);
  const evaluationRequestId = useRef(0);
  const evaluationController = useRef<AbortController | null>(null);
  const currentKeyRef = useRef("");
  const resultHeadingRef = useRef<HTMLHeadingElement>(null);
  const errorRef = useRef<HTMLDivElement>(null);

  const currentKey = useMemo(
    () => inputKey(routeStops, departureDate, returnDate, medicines),
    [departureDate, medicines, returnDate, routeStops],
  );
  currentKeyRef.current = currentKey;

  const travelCardModel = useMemo(
    () =>
      evaluation
        ? buildTravelCardModel(
            evaluation,
            departureDate,
            returnDate,
            nonEmptyMedicines(medicines),
          )
        : null,
    [departureDate, evaluation, medicines, returnDate],
  );

  useEffect(() => {
    listSavedTrips()
      .then(setSavedTrips)
      .catch(() =>
        setStorageError(
          "Saved trips are unavailable in this browser. You can still copy or print a travel card.",
        ),
      );
  }, []);

  useEffect(() => {
    const requestId = ++routeRequestId.current;
    setResolvedRoute(null);
    if (routeStops.length < 2) {
      setIsResolving(false);
      return;
    }

    const controller = new AbortController();
    setIsResolving(true);
    fetch("/api/routes/resolve", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        routeStopIds: routeStops.map(({ id }) => id),
      }),
      signal: controller.signal,
    })
      .then((response) => parseResponse<ResolvedRoute>(response))
      .then((route) => {
        if (requestId === routeRequestId.current) setResolvedRoute(route);
      })
      .catch((routeError) => {
        if (
          !controller.signal.aborted &&
          requestId === routeRequestId.current
        ) {
          setError(
            routeError instanceof Error
              ? routeError.message
              : "Route resolution failed.",
          );
        }
      })
      .finally(() => {
        if (requestId === routeRequestId.current) setIsResolving(false);
      });

    return () => controller.abort();
  }, [routeStops]);

  useEffect(() => {
    if (evaluation && evaluationKey !== currentKey) {
      evaluationController.current?.abort();
      setEvaluation(null);
      setEvaluationKey("");
      setStatus("Trip details changed. Run the guidance check again.");
    }
  }, [currentKey, evaluation, evaluationKey]);

  function addAirport(airport: Airport) {
    if (routeStops.at(-1)?.id === airport.id) {
      setError("Adjacent route stops must be different airports.");
      return;
    }
    setError("");
    setRouteStops((current) => [...current, airport]);
  }

  function moveStop(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= routeStops.length) return;
    const next = [...routeStops];
    [next[index], next[target]] = [next[target], next[index]];
    setRouteStops(next);
  }

  function validateForm() {
    if (routeStops.length < 2) return "Add at least an origin and destination.";
    if (returnDate && !departureDate) {
      return "Add a departure date before adding a return date.";
    }
    try {
      getTripDuration(departureDate || undefined, returnDate || undefined);
    } catch (dateError) {
      return dateError instanceof Error
        ? dateError.message
        : "Check the trip dates.";
    }
    return "";
  }

  async function evaluate(event: FormEvent) {
    event.preventDefault();
    const validationMessage = validateForm();
    if (validationMessage) {
      setError(validationMessage);
      window.requestAnimationFrame(() => errorRef.current?.focus());
      return;
    }

    const requestId = ++evaluationRequestId.current;
    const requestKey = currentKey;
    const controller = new AbortController();
    evaluationController.current?.abort();
    evaluationController.current = controller;
    setError("");
    setIsEvaluating(true);
    setStatus("Checking route guidance…");
    try {
      const response = await fetch("/api/guidance/evaluate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          routeStopIds: routeStops.map(({ id }) => id),
          ...(departureDate ? { departureDate } : {}),
          ...(returnDate ? { returnDate } : {}),
          medicationCategories: selectedCategories(medicines),
        }),
        signal: controller.signal,
      });
      const nextEvaluation = await parseResponse<GuidanceEvaluation>(response);
      if (
        requestId === evaluationRequestId.current &&
        currentKeyRef.current === requestKey
      ) {
        setEvaluation(nextEvaluation);
        setEvaluationKey(requestKey);
        setLoadedTripId(null);
        setStatus("Guidance ready.");
        window.requestAnimationFrame(() => resultHeadingRef.current?.focus());
      }
    } catch (evaluationError) {
      if (!controller.signal.aborted) {
        setError(
          evaluationError instanceof Error
            ? evaluationError.message
            : "Guidance evaluation failed.",
        );
        window.requestAnimationFrame(() => errorRef.current?.focus());
      }
    } finally {
      if (requestId === evaluationRequestId.current) setIsEvaluating(false);
    }
  }

  async function saveCurrentTrip() {
    if (!evaluation) return;
    const existing = loadedTripId
      ? savedTrips.find(({ id }) => id === loadedTripId)
      : undefined;
    try {
      const saved = await saveTrip({
        ...(loadedTripId ? { id: loadedTripId } : {}),
        ...(existing ? { createdAt: existing.createdAt } : {}),
        routeStops,
        ...(departureDate ? { departureDate } : {}),
        ...(returnDate ? { returnDate } : {}),
        medicines: nonEmptyMedicines(medicines),
        evaluatedGuidanceSnapshot: evaluation,
      });
      setLoadedTripId(saved.id);
      setSavedTrips(await listSavedTrips());
      setStorageError("");
      setStatus("Saved this trip and guidance snapshot on this device.");
    } catch {
      setStorageError(
        "This trip could not be saved. The current card is still available to copy or print.",
      );
    }
  }

  function restoreTrip(saved: SavedTrip) {
    setRouteStops(saved.routeStops);
    setDepartureDate(saved.departureDate ?? "");
    setReturnDate(saved.returnDate ?? "");
    setMedicines(
      saved.medicines.length > 0 ? saved.medicines : [createLocalMedicine()],
    );
    setLoadedTripId(saved.id);
    const snapshot = saved.evaluatedGuidanceSnapshot;
    if (snapshot.contractVersion === 2) {
      setResolvedRoute(snapshot.route);
      setEvaluation(snapshot);
      setEvaluationKey(
        inputKey(
          saved.routeStops,
          saved.departureDate ?? "",
          saved.returnDate ?? "",
          saved.medicines,
        ),
      );
      setStatus(
        snapshot.refreshAfter &&
          snapshot.refreshAfter <= new Date().toISOString().slice(0, 10)
          ? "Loaded an expired snapshot. Run the check again before relying on it."
          : "Loaded a saved snapshot. Medication rules can change; refresh before travel.",
      );
      window.requestAnimationFrame(() => resultHeadingRef.current?.focus());
    } else {
      setEvaluation(null);
      setEvaluationKey("");
      setStatus(
        "Loaded inputs from an older snapshot. Run the guidance check again.",
      );
    }
  }

  async function removeSavedTrip(id: string) {
    try {
      await deleteSavedTrip(id);
      setSavedTrips(await listSavedTrips());
      setDeleteConfirmation(null);
      if (loadedTripId === id) setLoadedTripId(null);
      setStatus("Deleted the saved trip from this device.");
    } catch {
      setStorageError("The saved trip could not be deleted.");
    }
  }

  async function removeAllSavedTrips() {
    try {
      await clearSavedTrips();
      setSavedTrips([]);
      setLoadedTripId(null);
      setConfirmClear(false);
      setStatus("Deleted all saved trips from this device.");
    } catch {
      setStorageError("Saved trips could not be cleared.");
    }
  }

  async function copyTravelCard() {
    if (!travelCardModel) return;
    try {
      await navigator.clipboard.writeText(
        formatTravelCardPlainText(travelCardModel),
      );
      setStatus("Copied the travel card as text.");
    } catch {
      setError(
        "The travel card could not be copied. Check clipboard permissions.",
      );
    }
  }

  function renderGuidance() {
    return (
      <section
        className="rounded-3xl border border-white/10 bg-slate-900/80 p-6"
        aria-busy={isEvaluating}
      >
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300">
          Guidance result
        </p>
        {!evaluation ? (
          <div className="py-14 text-center">
            <p className="text-xl font-semibold">
              Your route guidance will appear here
            </p>
            <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-slate-400">
              Missing or expired guidance is shown as unverified rather than
              treated as permission.
            </p>
          </div>
        ) : (
          <div className="mt-5 space-y-5">
            <div className="rounded-2xl border border-amber-300/30 bg-amber-300/10 p-5">
              <p className="text-sm text-slate-300">
                Prototype data · {evaluation.completeness} coverage
              </p>
              <h2
                ref={resultHeadingRef}
                tabIndex={-1}
                className="mt-1 text-2xl font-semibold outline-none"
              >
                {riskLabels[evaluation.overallRisk]}
              </h2>
              <p className="mt-2 text-sm text-slate-300">
                {evaluation.route.stops
                  .map(({ iataCode }) => iataCode)
                  .join(" → ")}
              </p>
              <p className="mt-2 text-sm text-amber-100">
                This local fixture is not production-eligible. Unverified
                coverage must be checked with official authorities.
              </p>
            </div>

            {evaluation.jurisdictions.map((jurisdiction) => (
              <article
                key={jurisdiction.jurisdictionId}
                className="rounded-2xl border border-white/15 bg-white/5 p-5"
              >
                <div className="flex flex-wrap justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-semibold">
                      {jurisdiction.name}
                    </h3>
                    <p className="text-xs uppercase text-slate-400">
                      {jurisdiction.jurisdictionType === "airport_authority"
                        ? "Airport screening"
                        : "Country guidance"}{" "}
                      · {jurisdiction.roles.join(" · ")}
                    </p>
                  </div>
                  <span className="text-sm text-amber-100">
                    {riskLabels[jurisdiction.riskLabel]}
                  </span>
                </div>

                {jurisdiction.coverageStatus !== "covered" ? (
                  <div className="mt-3 rounded-xl border border-amber-300/30 bg-amber-300/10 p-3 text-sm">
                    {jurisdiction.coverageStatus} coverage. Missing checks:
                    <ul className="mt-1 list-disc pl-5">
                      {jurisdiction.coverageGaps.map((gap, index) => (
                        <li
                          key={`${gap.medicationCategory}-${gap.reason}-${index}`}
                        >
                          {gap.medicationCategory
                            ? categoryLabels[gap.medicationCategory]
                            : "General guidance"}{" "}
                          — {gap.reason.replaceAll("_", " ")}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                <ul className="mt-4 list-disc space-y-2 pl-5 text-sm text-slate-200">
                  {jurisdiction.actions.map((action) => (
                    <li key={action}>{action}</li>
                  ))}
                </ul>
                <p className="mt-4 text-xs text-slate-400">
                  Confidence: {jurisdiction.confidence.replaceAll("_", " ")}
                  {jurisdiction.lastReviewedAt
                    ? ` · Reviewed ${jurisdiction.lastReviewedAt}`
                    : " · No reviewed date"}
                </p>
                <details className="mt-3">
                  <summary className="cursor-pointer text-sm text-cyan-200">
                    Sources used ({jurisdiction.sources.length})
                  </summary>
                  {jurisdiction.sources.length > 0 ? (
                    <ul className="mt-2 space-y-2 text-sm">
                      {jurisdiction.sources.map((source) => (
                        <li key={source.id}>
                          <a
                            href={source.url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-cyan-300 underline"
                          >
                            {source.title} (Tier {source.qualityTier}, verified{" "}
                            {source.lastVerifiedAt}; opens in a new tab)
                          </a>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-2 text-sm text-amber-100">
                      No reviewed source is available for this scope.
                    </p>
                  )}
                </details>
              </article>
            ))}

            {travelCardModel ? <TravelCard model={travelCardModel} /> : null}
            <div className="no-print grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={copyTravelCard}
                className="min-h-11 rounded-full border border-cyan-300/40 px-5 py-3"
              >
                Copy card text
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="min-h-11 rounded-full border border-cyan-300/40 px-5 py-3"
              >
                Print card
              </button>
            </div>
            <button
              type="button"
              onClick={saveCurrentTrip}
              className="no-print min-h-11 w-full rounded-full border border-cyan-300/40 px-5 py-3"
            >
              {loadedTripId ? "Update saved trip" : "Save on this device"}
            </button>
          </div>
        )}
      </section>
    );
  }

  function renderSavedTrips() {
    return (
      <section className="no-print rounded-3xl border border-white/10 bg-white/5 p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h2 className="text-xl font-semibold">Saved on this device</h2>
          {savedTrips.length > 0 && !confirmClear ? (
            <button
              type="button"
              onClick={() => setConfirmClear(true)}
              className="min-h-11 text-sm text-rose-200 underline"
            >
              Clear all
            </button>
          ) : null}
        </div>

        {storageError ? (
          <p role="alert" className="mt-3 text-sm text-rose-200">
            {storageError}
          </p>
        ) : null}

        {confirmClear ? (
          <div className="mt-3 rounded-xl border border-rose-300/30 p-3 text-sm">
            <p>Delete all {savedTrips.length} saved trips from this device?</p>
            <div className="mt-2 flex gap-3">
              <button
                type="button"
                onClick={removeAllSavedTrips}
                className="min-h-11 text-rose-200 underline"
              >
                Confirm clear all
              </button>
              <button
                type="button"
                onClick={() => setConfirmClear(false)}
                className="min-h-11 underline"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : null}

        {savedTrips.length === 0 ? (
          <p className="mt-4 text-sm text-slate-400">No locally saved trips.</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {savedTrips.map((saved) => (
              <li
                key={saved.id}
                className="rounded-xl border border-white/15 p-3"
              >
                <button
                  type="button"
                  onClick={() => restoreTrip(saved)}
                  className="min-h-11 w-full text-left"
                >
                  <span className="block font-medium">
                    {saved.routeStops
                      .map(({ iataCode }) => iataCode)
                      .join(" → ")}
                  </span>
                  <span className="block text-xs text-slate-400">
                    {saved.departureDate ?? "Dates not provided"}
                    {saved.returnDate ? ` to ${saved.returnDate}` : ""}
                    {" · "}Saved {saved.updatedAt}
                  </span>
                </button>

                {deleteConfirmation === saved.id ? (
                  <div className="mt-2 flex flex-wrap items-center gap-3 text-sm">
                    <span>Delete this saved trip?</span>
                    <button
                      type="button"
                      onClick={() => removeSavedTrip(saved.id)}
                      className="min-h-11 text-rose-200 underline"
                    >
                      Confirm delete
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteConfirmation(null)}
                      className="min-h-11 underline"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setDeleteConfirmation(saved.id)}
                    className="mt-2 min-h-11 text-sm text-rose-200"
                  >
                    Delete
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    );
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
      <form onSubmit={evaluate} className="space-y-6" noValidate>
        <p className="sr-only" role="status" aria-live="polite">
          {status}
        </p>

        <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300">
            1 · Route
          </p>
          <h2 className="mt-2 text-xl font-semibold">
            Add airports in travel order
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-300">
            Include the origin, destination, and every layover.
          </p>
          <AirportCombobox onSelect={addAirport} />
          <ol className="mt-5 space-y-2" aria-label="Selected route">
            {routeStops.map((airport, index) => (
              <li
                key={`${airport.id}-${index}`}
                className="flex flex-wrap items-center gap-2 rounded-xl border border-white/15 bg-slate-900/80 p-3"
              >
                <span className="min-w-0 flex-1">
                  <strong>{airport.iataCode}</strong>
                  <span className="ml-2 text-sm text-slate-300">
                    {airport.city}, {airport.countryName}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => moveStop(index, -1)}
                  disabled={index === 0}
                  className="min-h-11 min-w-11 rounded-lg border border-white/20 disabled:opacity-30"
                  aria-label={`Move ${airport.iataCode} earlier`}
                >
                  ↑
                </button>
                <button
                  type="button"
                  onClick={() => moveStop(index, 1)}
                  disabled={index === routeStops.length - 1}
                  className="min-h-11 min-w-11 rounded-lg border border-white/20 disabled:opacity-30"
                  aria-label={`Move ${airport.iataCode} later`}
                >
                  ↓
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setRouteStops((current) =>
                      current.filter((_, item) => item !== index),
                    )
                  }
                  className="min-h-11 px-2 text-sm text-rose-200"
                  aria-label={`Remove ${airport.iataCode}`}
                >
                  Remove
                </button>
              </li>
            ))}
          </ol>
          {resolvedRoute ? (
            <div className="mt-4 rounded-xl bg-slate-950/70 p-4 text-sm">
              <p className="font-medium">Jurisdictions found</p>
              <ul className="mt-2 space-y-1 text-slate-300">
                {resolvedRoute.countries.map((country) => (
                  <li key={country.id}>
                    {country.name} · {country.roles.join(", ")}
                  </li>
                ))}
              </ul>
            </div>
          ) : isResolving ? (
            <p role="status" className="mt-4 text-sm text-slate-300">
              Resolving route…
            </p>
          ) : null}
        </section>

        <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300">
            2 · Dates
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-medium">
              Departure date
              <input
                type="date"
                value={departureDate}
                onChange={(event) => setDepartureDate(event.target.value)}
                className="mt-2 min-h-11 w-full rounded-xl border border-white/30 bg-slate-950 px-3"
              />
            </label>
            <label className="text-sm font-medium">
              Return date (optional)
              <input
                type="date"
                value={returnDate}
                min={departureDate || undefined}
                onChange={(event) => setReturnDate(event.target.value)}
                className="mt-2 min-h-11 w-full rounded-xl border border-white/30 bg-slate-950 px-3"
              />
            </label>
          </div>
          <div className="mt-4">
            <DurationNotice
              departureDate={departureDate}
              returnDate={returnDate}
            />
          </div>
        </section>

        <MedicineEditor medicines={medicines} onChange={setMedicines} />

        {error ? (
          <div
            ref={errorRef}
            tabIndex={-1}
            role="alert"
            className="rounded-xl border border-rose-300/30 bg-rose-400/10 p-4 text-rose-100"
          >
            <p className="font-semibold">Check the trip details</p>
            <p className="mt-1">{error}</p>
          </div>
        ) : null}
        <button
          type="submit"
          disabled={isEvaluating || isResolving}
          className="min-h-12 w-full rounded-full bg-cyan-300 px-6 py-3 font-semibold text-slate-950 disabled:opacity-60"
        >
          {isEvaluating ? "Checking route…" : "Get route guidance"}
        </button>
      </form>

      <div className="space-y-6">
        {renderGuidance()}
        {renderSavedTrips()}
      </div>
    </div>
  );
}
