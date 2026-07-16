"use client";

import { useEffect, useId, useMemo, useState } from "react";
import type { Airport } from "@/lib/airports";
import { searchAirports } from "@/lib/airports";

type AirportSearchProps = {
  airport: Airport | null;
  error?: string;
  label: string;
  onSelect: (airport: Airport | null) => void;
};

function airportLabel(airport: Airport) {
  return `${airport.code} — ${airport.city}, ${airport.country}`;
}

export function AirportSearch({
  airport,
  error,
  label,
  onSelect,
}: AirportSearchProps) {
  const inputId = useId();
  const listboxId = `${inputId}-results`;
  const [query, setQuery] = useState(airport ? airportLabel(airport) : "");
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const results = useMemo(
    () => (airport ? [] : searchAirports(query)),
    [airport, query],
  );

  useEffect(() => {
    setQuery(airport ? airportLabel(airport) : "");
  }, [airport]);

  function selectAirport(selectedAirport: Airport) {
    onSelect(selectedAirport);
    setQuery(airportLabel(selectedAirport));
    setIsOpen(false);
    setActiveIndex(-1);
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown" && results.length > 0) {
      event.preventDefault();
      setIsOpen(true);
      setActiveIndex((current) => Math.min(current + 1, results.length - 1));
    } else if (event.key === "ArrowUp" && results.length > 0) {
      event.preventDefault();
      setActiveIndex((current) => Math.max(current - 1, 0));
    } else if (event.key === "Enter" && activeIndex >= 0) {
      event.preventDefault();
      selectAirport(results[activeIndex]);
    } else if (event.key === "Escape") {
      setIsOpen(false);
      setActiveIndex(-1);
    }
  }

  const showNoResults =
    isOpen && query.trim().length > 1 && results.length === 0 && !airport;

  return (
    <div className="relative">
      <label
        htmlFor={inputId}
        className="mb-2 block text-sm font-semibold text-slate-100"
      >
        {label}
      </label>
      <input
        id={inputId}
        type="text"
        role="combobox"
        autoComplete="off"
        aria-autocomplete="list"
        aria-controls={listboxId}
        aria-expanded={isOpen && results.length > 0}
        aria-activedescendant={
          activeIndex >= 0 ? `${listboxId}-${activeIndex}` : undefined
        }
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${inputId}-error` : undefined}
        value={query}
        placeholder="Search code, city, airport, or country"
        onBlur={() => window.setTimeout(() => setIsOpen(false), 150)}
        onFocus={() => setIsOpen(true)}
        onKeyDown={handleKeyDown}
        onChange={(event) => {
          setQuery(event.target.value);
          onSelect(null);
          setIsOpen(true);
          setActiveIndex(-1);
        }}
        className="min-h-12 w-full rounded-xl border border-white/15 bg-slate-950/70 px-4 py-3 text-base text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300 focus:ring-2 focus:ring-cyan-300/20"
      />
      <p className="sr-only" aria-live="polite">
        {airport
          ? `${airport.code}, ${airport.city}, selected`
          : query.trim().length > 0
            ? `${results.length} airport result${results.length === 1 ? "" : "s"} available`
            : ""}
      </p>
      {error ? (
        <p id={`${inputId}-error`} className="mt-2 text-sm text-rose-300">
          {error}
        </p>
      ) : null}
      {isOpen && results.length > 0 ? (
        <ul
          id={listboxId}
          role="listbox"
          className="absolute z-20 mt-2 max-h-72 w-full overflow-y-auto rounded-xl border border-white/15 bg-slate-900 p-2 shadow-2xl shadow-slate-950"
        >
          {results.map((result, index) => (
            <li
              id={`${listboxId}-${index}`}
              key={result.id}
              role="option"
              aria-selected={activeIndex === index}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => selectAirport(result)}
              className={`cursor-pointer rounded-lg px-3 py-3 text-left transition ${
                activeIndex === index ? "bg-cyan-300/15" : "hover:bg-white/10"
              }`}
            >
              <span className="font-semibold text-white">{result.code}</span>
              <span className="ml-2 text-sm text-slate-300">{result.name}</span>
              <span className="mt-1 block text-xs text-slate-400">
                {result.city}, {result.country}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
      {showNoResults ? (
        <div className="absolute z-20 mt-2 w-full rounded-xl border border-white/15 bg-slate-900 p-4 text-sm text-slate-300 shadow-2xl">
          We couldn’t find that airport. Try the airport code, city, or country.
        </div>
      ) : null}
    </div>
  );
}
