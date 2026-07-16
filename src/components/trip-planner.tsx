"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { DurationNotice } from "@/components/duration-notice";
import {
  medicationCategories,
  type Airport,
  type GuidanceEvaluation,
  type MedicationCategory,
  type ResolvedRoute,
  type RiskLabel,
} from "@/lib/domain";
import {
  clearSavedTrips,
  deleteSavedTrip,
  listSavedTrips,
  saveTrip,
  type LocalMedicine,
  type SavedTrip,
} from "@/lib/saved-trips";

const categoryLabels: Record<MedicationCategory, string> = {
  prescription: "Prescription medicine",
  over_the_counter: "Over-the-counter medicine",
  controlled_substance: "Controlled substance",
  opioid: "Opioid",
  stimulant_adhd: "ADHD stimulant",
  sedative_anxiety: "Sedative or anxiety medicine",
  sleep_medication: "Sleep medicine",
  pseudoephedrine: "Pseudoephedrine",
  cannabis_derived: "Cannabis-derived product",
  injectable: "Injectable",
  liquid_over_100ml: "Liquid over 100 mL",
  refrigerated: "Refrigerated medicine",
  medical_device: "Medical device",
  needles_or_sharps: "Needles or sharps",
  unknown: "Not sure",
};

const riskLabels: Record<RiskLabel, string> = {
  likely_ok: "Likely OK",
  check_documentation: "Check documentation",
  prior_permission_may_be_required: "Prior permission may be required",
  high_risk: "High risk — verify before travel",
  unknown: "Not yet verified",
};

async function parseResponse<T>(response: Response): Promise<T> {
  const body = await response.json();
  if (!response.ok) {
    throw new Error(body.error ?? "The request could not be completed");
  }
  return body;
}

export function TripPlanner() {
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Airport[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [routeStops, setRouteStops] = useState<Airport[]>([]);
  const [resolvedRoute, setResolvedRoute] = useState<ResolvedRoute | null>(
    null,
  );
  const [departureDate, setDepartureDate] = useState("");
  const [returnDate, setReturnDate] = useState("");
  const [medicine, setMedicine] = useState<LocalMedicine>({
    id: "medicine_1",
    name: "",
    categories: [],
  });
  const [evaluation, setEvaluation] = useState<GuidanceEvaluation | null>(null);
  const [savedTrips, setSavedTrips] = useState<SavedTrip[]>([]);
  const [error, setError] = useState("");
  const [isResolving, setIsResolving] = useState(false);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [savedMessage, setSavedMessage] = useState("");

  const medicines = useMemo(
    () => (medicine.name || medicine.categories.length > 0 ? [medicine] : []),
    [medicine],
  );

  useEffect(() => {
    listSavedTrips()
      .then(setSavedTrips)
      .catch(() => setSavedTrips([]));
  }, []);

  useEffect(() => {
    const search = query.trim();
    if (!search) return;

    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      setIsSearching(true);
      try {
        const response = await fetch(
          `/api/airports/search?q=${encodeURIComponent(search)}&limit=8`,
          { signal: controller.signal },
        );
        const body = await parseResponse<{ results: Airport[] }>(response);
        setSearchResults(body.results);
      } catch (searchError) {
        if (!controller.signal.aborted) {
          setError(
            searchError instanceof Error
              ? searchError.message
              : "Airport search failed",
          );
        }
      } finally {
        if (!controller.signal.aborted) setIsSearching(false);
      }
    }, 200);

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [query]);

  useEffect(() => {
    if (routeStops.length < 2) return;

    const controller = new AbortController();
    fetch("/api/routes/resolve", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ routeStopIds: routeStops.map(({ id }) => id) }),
      signal: controller.signal,
    })
      .then((response) => parseResponse<ResolvedRoute>(response))
      .then(setResolvedRoute)
      .catch((routeError) => {
        if (!controller.signal.aborted) {
          setError(
            routeError instanceof Error
              ? routeError.message
              : "Route resolution failed",
          );
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsResolving(false);
      });

    return () => controller.abort();
  }, [routeStops]);

  function invalidateEvaluation() {
    setEvaluation(null);
    setSavedMessage("");
  }

  function replaceRoute(next: Airport[]) {
    setRouteStops(next);
    setResolvedRoute(null);
    invalidateEvaluation();
    setIsResolving(next.length >= 2);
  }

  function addAirport(airport: Airport) {
    replaceRoute([...routeStops, airport]);
    setQuery("");
    setSearchResults([]);
    setError("");
  }

  function moveStop(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= routeStops.length) return;
    const next = [...routeStops];
    [next[index], next[target]] = [next[target], next[index]];
    replaceRoute(next);
  }

  function toggleCategory(category: MedicationCategory) {
    setMedicine((current) => ({
      ...current,
      categories: current.categories.includes(category)
        ? current.categories.filter((item) => item !== category)
        : [...current.categories, category],
    }));
    invalidateEvaluation();
  }

  async function evaluate(event: FormEvent) {
    event.preventDefault();
    setError("");
    if (routeStops.length < 2) {
      setError("Add at least an origin and destination.");
      return;
    }

    setIsEvaluating(true);
    try {
      const categories = [
        ...new Set(medicines.flatMap(({ categories: values }) => values)),
      ];
      const response = await fetch("/api/guidance/evaluate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          routeStopIds: routeStops.map(({ id }) => id),
          ...(departureDate ? { departureDate } : {}),
          ...(returnDate ? { returnDate } : {}),
          medicationCategories: categories,
        }),
      });
      setEvaluation(await parseResponse<GuidanceEvaluation>(response));
    } catch (evaluationError) {
      setError(
        evaluationError instanceof Error
          ? evaluationError.message
          : "Guidance evaluation failed",
      );
    } finally {
      setIsEvaluating(false);
    }
  }

  async function saveCurrentTrip() {
    if (!evaluation) return;
    await saveTrip({
      routeStops,
      ...(departureDate ? { departureDate } : {}),
      ...(returnDate ? { returnDate } : {}),
      medicines,
      evaluatedGuidanceSnapshot: evaluation,
    });
    setSavedTrips(await listSavedTrips());
    setSavedMessage("Saved this guidance on this device.");
  }

  function restoreTrip(saved: SavedTrip) {
    setRouteStops(saved.routeStops);
    setResolvedRoute(saved.evaluatedGuidanceSnapshot.route);
    setDepartureDate(saved.departureDate ?? "");
    setReturnDate(saved.returnDate ?? "");
    setMedicine(
      saved.medicines[0] ?? { id: "medicine_1", name: "", categories: [] },
    );
    setEvaluation(saved.evaluatedGuidanceSnapshot);
    setSavedMessage("Loaded the saved guidance snapshot.");
  }

  async function removeSavedTrip(id: string) {
    await deleteSavedTrip(id);
    setSavedTrips(await listSavedTrips());
  }

  async function removeAllSavedTrips() {
    await clearSavedTrips();
    setSavedTrips([]);
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
      <form onSubmit={evaluate} className="space-y-6">
        <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300">
            1 · Route
          </p>
          <h2 className="mt-2 text-xl font-semibold">
            Add airports in travel order
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-300">
            Origin, destination, and every layover are resolved on the server.
          </p>
          <label
            htmlFor="airport-search"
            className="mt-5 block text-sm font-medium"
          >
            Airport code, airport, city, or country
          </label>
          <input
            id="airport-search"
            value={query}
            onChange={(event) => {
              const nextQuery = event.target.value;
              setQuery(nextQuery);
              if (!nextQuery.trim()) {
                setSearchResults([]);
                setIsSearching(false);
              }
            }}
            autoComplete="off"
            className="mt-2 min-h-11 w-full rounded-xl border border-white/15 bg-slate-950 px-4 py-3 outline-none focus:border-cyan-300"
            placeholder="Try JFK, London, or Japan"
            aria-describedby="airport-search-status"
          />
          <p
            id="airport-search-status"
            role="status"
            className="mt-2 text-xs text-slate-400"
          >
            {isSearching
              ? "Searching airports…"
              : `${searchResults.length} airport${searchResults.length === 1 ? "" : "s"} found`}
          </p>
          {searchResults.length > 0 ? (
            <ul className="mt-3 space-y-2" aria-label="Airport search results">
              {searchResults.map((airport) => (
                <li key={airport.id}>
                  <button
                    type="button"
                    onClick={() => addAirport(airport)}
                    className="flex min-h-11 w-full justify-between rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-left hover:border-cyan-400/50"
                  >
                    <span>
                      <strong>{airport.iataCode}</strong> · {airport.name}
                      <span className="block text-xs text-slate-400">
                        {airport.city}, {airport.countryName}
                      </span>
                    </span>
                    <span aria-hidden="true">＋</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}

          <ol className="mt-5 space-y-2" aria-label="Selected route">
            {routeStops.map((airport, index) => (
              <li
                key={`${airport.id}-${index}`}
                className="flex items-center gap-2 rounded-xl border border-white/10 bg-slate-900/80 p-3"
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
                  className="min-h-11 min-w-11 rounded-lg border border-white/10 disabled:opacity-30"
                  aria-label={`Move ${airport.iataCode} earlier`}
                >
                  ↑
                </button>
                <button
                  type="button"
                  onClick={() => moveStop(index, 1)}
                  disabled={index === routeStops.length - 1}
                  className="min-h-11 min-w-11 rounded-lg border border-white/10 disabled:opacity-30"
                  aria-label={`Move ${airport.iataCode} later`}
                >
                  ↓
                </button>
                <button
                  type="button"
                  onClick={() =>
                    replaceRoute(routeStops.filter((_, item) => item !== index))
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
            <p className="mt-4 text-sm text-slate-300">Resolving route…</p>
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
                onChange={(event) => {
                  setDepartureDate(event.target.value);
                  invalidateEvaluation();
                }}
                className="mt-2 min-h-11 w-full rounded-xl border border-white/15 bg-slate-950 px-3"
              />
            </label>
            <label className="text-sm font-medium">
              Return date (optional)
              <input
                type="date"
                value={returnDate}
                min={departureDate || undefined}
                onChange={(event) => {
                  setReturnDate(event.target.value);
                  invalidateEvaluation();
                }}
                className="mt-2 min-h-11 w-full rounded-xl border border-white/15 bg-slate-950 px-3"
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

        <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300">
            3 · Medicine context (optional)
          </p>
          <div className="mt-3 rounded-xl border border-emerald-400/20 bg-emerald-400/10 p-3 text-sm leading-6 text-emerald-100">
            Medicine names stay in this browser. Only normalized category flags
            are sent for evaluation. Local saves may be visible to other people
            using this browser profile.
          </div>
          <label
            htmlFor="medicine-name"
            className="mt-4 block text-sm font-medium"
          >
            Medicine name (saved locally only)
          </label>
          <input
            id="medicine-name"
            value={medicine.name}
            onChange={(event) =>
              setMedicine((current) => ({
                ...current,
                name: event.target.value,
              }))
            }
            className="mt-2 min-h-11 w-full rounded-xl border border-white/15 bg-slate-950 px-4"
          />
          <fieldset className="mt-5">
            <legend className="text-sm font-medium">
              Categories and special handling
            </legend>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {medicationCategories.map((category) => (
                <label
                  key={category}
                  className="flex min-h-11 items-center gap-3 rounded-xl border border-white/10 bg-slate-900/70 px-3 py-2 text-sm"
                >
                  <input
                    type="checkbox"
                    checked={medicine.categories.includes(category)}
                    onChange={() => toggleCategory(category)}
                    className="h-4 w-4 accent-cyan-300"
                  />
                  {categoryLabels[category]}
                </label>
              ))}
            </div>
          </fieldset>
        </section>

        {error ? (
          <div
            role="alert"
            className="rounded-xl border border-rose-300/30 bg-rose-400/10 p-4 text-rose-100"
          >
            {error}
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
        <section className="rounded-3xl border border-white/10 bg-slate-900/80 p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300">
            Server-backed result
          </p>
          {!evaluation ? (
            <div className="py-14 text-center">
              <p className="text-xl font-semibold">
                Your route guidance will appear here
              </p>
              <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-slate-400">
                Add at least two airports. The server resolves every
                jurisdiction without receiving medicine names.
              </p>
            </div>
          ) : (
            <div className="mt-5 space-y-5">
              <div className="rounded-2xl border border-cyan-300/30 bg-cyan-300/10 p-5">
                <p className="text-sm text-slate-300">Overall result</p>
                <h2 className="mt-1 text-2xl font-semibold">
                  {riskLabels[evaluation.overallRisk]}
                </h2>
                <p className="mt-2 text-sm text-slate-300">
                  {evaluation.route.stops
                    .map(({ iataCode }) => iataCode)
                    .join(" → ")}
                </p>
              </div>
              {evaluation.jurisdictions.map((jurisdiction) => (
                <article
                  key={jurisdiction.jurisdictionId}
                  className="rounded-2xl border border-white/10 bg-white/5 p-5"
                >
                  <div className="flex flex-wrap justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-semibold">
                        {jurisdiction.name}
                      </h3>
                      <p className="text-xs uppercase text-slate-400">
                        {jurisdiction.roles.join(" · ")}
                      </p>
                    </div>
                    <span className="text-sm text-amber-100">
                      {riskLabels[jurisdiction.riskLabel]}
                    </span>
                  </div>
                  <ul className="mt-4 space-y-2 text-sm text-slate-200">
                    {jurisdiction.actions.map((action) => (
                      <li key={action}>✓ {action}</li>
                    ))}
                  </ul>
                  <p className="mt-4 text-xs text-slate-400">
                    Confidence: {jurisdiction.confidence.replaceAll("_", " ")}
                    {jurisdiction.lastReviewedAt
                      ? ` · Reviewed ${jurisdiction.lastReviewedAt}`
                      : ""}
                  </p>
                  {jurisdiction.sources.length > 0 ? (
                    <details className="mt-3">
                      <summary className="cursor-pointer text-sm text-cyan-200">
                        Official sources
                      </summary>
                      <ul className="mt-2 space-y-2 text-sm">
                        {jurisdiction.sources.map((source) => (
                          <li key={source.id}>
                            <a
                              href={source.url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-cyan-300 underline"
                            >
                              {source.title}
                            </a>
                          </li>
                        ))}
                      </ul>
                    </details>
                  ) : null}
                </article>
              ))}
              <div className="rounded-xl border border-amber-300/20 bg-amber-300/10 p-4 text-sm">
                Preparation guidance only. Verify current requirements with the
                linked authority before travel.
              </div>
              <button
                type="button"
                onClick={saveCurrentTrip}
                className="min-h-11 w-full rounded-full border border-cyan-300/40 px-5 py-3"
              >
                Save guidance on this device
              </button>
              {savedMessage ? (
                <p role="status" className="text-sm text-emerald-200">
                  {savedMessage}
                </p>
              ) : null}
            </div>
          )}
        </section>

        <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-xl font-semibold">Saved on this device</h2>
            {savedTrips.length > 0 ? (
              <button
                type="button"
                onClick={removeAllSavedTrips}
                className="min-h-11 text-sm text-rose-200 underline"
              >
                Clear all
              </button>
            ) : null}
          </div>
          {savedTrips.length === 0 ? (
            <p className="mt-4 text-sm text-slate-400">
              No locally saved trips.
            </p>
          ) : (
            <ul className="mt-4 space-y-2">
              {savedTrips.map((saved) => (
                <li
                  key={saved.id}
                  className="flex items-center gap-3 rounded-xl border border-white/10 p-3"
                >
                  <button
                    type="button"
                    onClick={() => restoreTrip(saved)}
                    className="min-h-11 min-w-0 flex-1 text-left"
                  >
                    {saved.routeStops
                      .map(({ iataCode }) => iataCode)
                      .join(" → ")}
                  </button>
                  <button
                    type="button"
                    onClick={() => removeSavedTrip(saved.id)}
                    className="min-h-11 text-sm text-rose-200"
                  >
                    Delete
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
