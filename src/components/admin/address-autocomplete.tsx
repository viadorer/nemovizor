"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useT } from "@/i18n/provider";

const MAPY_API_KEY = process.env.NEXT_PUBLIC_MAPY_API_KEY ?? "";
const SUGGEST_URL = "https://api.mapy.cz/v1/suggest";

export type MapySuggestion = {
  name: string;
  label: string;
  location: string;
  position: { lat: number; lon: number };
  regionalStructure: { type: string; name: string }[];
  type: string;
  zip?: string;
};

type SuggestResponse = {
  items: MapySuggestion[];
};

function getTypeIcon(type: string) {
  if (type.includes("street") || type.includes("address")) {
    return (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
        <path d="M9 22V12h6v10" />
      </svg>
    );
  }
  if (type.includes("city") || type.includes("municipality")) {
    return (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="4" y="2" width="16" height="20" rx="2" />
        <path d="M9 22V12h6v10M9 6h.01M15 6h.01M9 10h.01M15 10h.01" />
      </svg>
    );
  }
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}

export function AddressAutocomplete({
  onSelect,
  isLand,
}: {
  onSelect: (s: MapySuggestion) => void;
  isLand: boolean;
}) {
  const t = useT();
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<MapySuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Fetch suggestions from Mapy.cz
  const fetchSuggestions = useCallback(async (q: string) => {
    if (q.length < 2) {
      setSuggestions([]);
      setOpen(false);
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);

    try {
      // For land: search broader (regional), for other types: specific addresses
      const searchType = isLand ? "regional" : "regional.address";
      const params = new URLSearchParams({
        query: q,
        lang: "cs",
        limit: "6",
        type: searchType,
        apikey: MAPY_API_KEY,
      });

      const res = await fetch(`${SUGGEST_URL}?${params}`, {
        signal: controller.signal,
        headers: { "X-Mapy-Api-Key": MAPY_API_KEY },
      });

      if (!res.ok) throw new Error(`Mapy.cz HTTP ${res.status}`);
      const data: SuggestResponse = await res.json();
      const items = data.items || [];

      setSuggestions(items);
      setOpen(items.length > 0);
      setHighlightIndex(-1);
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        setSuggestions([]);
      }
    } finally {
      setLoading(false);
    }
  }, [isLand]);

  // Debounced input handler
  function handleInput(value: string) {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!MAPY_API_KEY || value.trim().length < 2) {
      setSuggestions([]);
      setOpen(false);
      return;
    }

    debounceRef.current = setTimeout(() => fetchSuggestions(value), 250);
  }

  function handleSelect(s: MapySuggestion) {
    // Build readable label from name + location
    const display = s.name + (s.location ? `, ${s.location}` : "");
    setQuery(display);
    setOpen(false);
    setSuggestions([]);
    onSelect(s);
  }

  function handleClear() {
    setQuery("");
    setSuggestions([]);
    setOpen(false);
    inputRef.current?.focus();
  }

  // Keyboard navigation
  function handleKeyDown(e: React.KeyboardEvent) {
    if (!open || suggestions.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightIndex((prev) => (prev + 1) % suggestions.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightIndex((prev) => (prev <= 0 ? suggestions.length - 1 : prev - 1));
    } else if (e.key === "Enter" && highlightIndex >= 0) {
      e.preventDefault();
      handleSelect(suggestions[highlightIndex]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  if (!MAPY_API_KEY) {
    return (
      <div className="admin-form-group">
        <label>{t.addressSearch.manualLabel}</label>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t.addressSearch.manualPlaceholder}
        />
        {isLand && (
          <p className="pf-hint">{t.addressSearch.landHint}</p>
        )}
      </div>
    );
  }

  return (
    <div className="admin-form-group pf-address-suggest" ref={wrapRef}>
      <label>{t.addressSearch.searchLabel}</label>
      <div className="pf-address-input-wrap">
        <svg className="pf-address-input-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="8" />
          <path d="M21 21l-4.35-4.35" />
        </svg>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => handleInput(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => suggestions.length > 0 && setOpen(true)}
          placeholder={isLand ? "Hledat lokalitu nebo katastr..." : "Za\u010dn\u011bte ps\u00e1t adresu..."}
          className="pf-address-input"
        />
        {loading && <div className="pf-address-spinner" />}
        {query && !loading && (
          <button type="button" className="pf-address-clear" onClick={handleClear}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>
      {isLand && (
        <p className="pf-hint">{"U pozemk\u016f adresa nemus\u00ed existovat \u2014 zadejte \u00fadaje ru\u010dn\u011b."}</p>
      )}

      {open && suggestions.length > 0 && (
        <div className="pf-address-suggest__dropdown">
          {suggestions.map((s, i) => (
            <button
              key={`${s.name}-${s.position.lat}-${s.position.lon}`}
              type="button"
              className={`pf-address-suggest__item${i === highlightIndex ? " pf-address-suggest__item--active" : ""}`}
              onClick={() => handleSelect(s)}
              onMouseEnter={() => setHighlightIndex(i)}
            >
              <span className="pf-address-suggest__icon">
                {getTypeIcon(s.type || "")}
              </span>
              <div className="pf-address-suggest__text">
                <span className="pf-address-suggest__name">{s.name}</span>
                {s.location && (
                  <span className="pf-address-suggest__location">{s.location}</span>
                )}
              </div>
            </button>
          ))}
          <div className="pf-address-suggest__footer">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
              <circle cx="12" cy="10" r="3" />
            </svg>
            Mapy.com
          </div>
        </div>
      )}
    </div>
  );
}
