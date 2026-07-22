"use client";

import { KeyboardEvent, useEffect, useRef, useState } from "react";
import type { Airport } from "@/lib/domain";

interface AirportComboboxProps {
  onSelect: (airport: Airport) => void;
}

async function readResults(response: Response) {
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    throw new Error("Airport search returned an unreadable response.");
  }
  const body = (await response.json()) as {
    error?: string;
    results?: Airport[];
  };
  if (!response.ok) {
    throw new Error(body.error ?? "Airport search failed.");
  }
  return body.results ?? [];
}

export function AirportCombobox({ onSelect }: AirportComboboxProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Airport[]>([]);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState("");
  const requestId = useRef(0);

  useEffect(() => {
    const search = query.trim();
    const currentRequest = ++requestId.current;
    setResults([]);
    setActiveIndex(-1);
    setError("");
    if (!search) {
      setIsSearching(false);
      return;
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      setIsSearching(true);
      try {
        const response = await fetch(
          `/api/airports/search?q=${encodeURIComponent(search)}&limit=8`,
          { signal: controller.signal },
        );
        const nextResults = await readResults(response);
        if (currentRequest === requestId.current) setResults(nextResults);
      } catch (searchError) {
        if (
          !controller.signal.aborted &&
          currentRequest === requestId.current
        ) {
          setError(
            searchError instanceof Error
              ? searchError.message
              : "Airport search failed.",
          );
        }
      } finally {
        if (currentRequest === requestId.current) setIsSearching(false);
      }
    }, 200);

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [query]);

  function choose(airport: Airport) {
    onSelect(airport);
    setQuery("");
    setResults([]);
    setActiveIndex(-1);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      setResults([]);
      setActiveIndex(-1);
      return;
    }
    if (results.length === 0) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((current) =>
        current < results.length - 1 ? current + 1 : 0,
      );
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((current) =>
        current > 0 ? current - 1 : results.length - 1,
      );
    } else if (event.key === "Enter" && activeIndex >= 0) {
      event.preventDefault();
      choose(results[activeIndex]);
    }
  }

  return (
    <div>
      <label
        htmlFor="airport-search"
        className="mt-5 block text-sm font-medium"
      >
        Airport code, airport, city, or country
      </label>
      <input
        id="airport-search"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={results.length > 0}
        aria-controls="airport-search-results"
        aria-activedescendant={
          activeIndex >= 0
            ? `airport-option-${results[activeIndex]?.id}`
            : undefined
        }
        aria-describedby="airport-search-status"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        onKeyDown={handleKeyDown}
        autoComplete="off"
        className="mt-2 min-h-11 w-full rounded-xl border border-white/30 bg-slate-950 px-4 py-3 outline-none focus:border-cyan-300"
        placeholder="Try JFK, London, or Japan"
      />
      <p
        id="airport-search-status"
        role="status"
        className={`mt-2 text-xs ${error ? "text-rose-300" : "text-slate-400"}`}
      >
        {error
          ? error
          : isSearching
            ? "Searching airports…"
            : query.trim()
              ? `${results.length} airport${results.length === 1 ? "" : "s"} found`
              : "Start typing to search airports"}
      </p>
      <ul id="airport-search-results" role="listbox" className="mt-3 space-y-2">
        {results.map((airport, index) => (
          <li
            id={`airport-option-${airport.id}`}
            key={airport.id}
            role="option"
            aria-selected={activeIndex === index}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => choose(airport)}
            className={`cursor-pointer rounded-xl border px-4 py-3 ${
              activeIndex === index
                ? "border-cyan-300 bg-cyan-300/10"
                : "border-white/15 bg-slate-900"
            }`}
          >
            <strong>{airport.iataCode}</strong> · {airport.name}
            <span className="block text-xs text-slate-400">
              {airport.city}, {airport.countryName}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
