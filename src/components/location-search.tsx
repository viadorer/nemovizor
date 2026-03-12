"use client";

import { useState, useRef, useEffect, useCallback } from "react";

// ===== Mapy.com Suggest API =====
// API klíč nastavte v .env.local jako NEXT_PUBLIC_MAPY_API_KEY
// Registrace: https://developer.mapy.com/

const MAPY_API_KEY = process.env.NEXT_PUBLIC_MAPY_API_KEY ?? "";
const SUGGEST_URL = "https://api.mapy.cz/v1/suggest";

type SuggestItem = {
  name: string;
  label: string;
  location: string;
  position: { lat: number; lon: number };
  bbox?: [number, number, number, number]; // [minLon, minLat, maxLon, maxLat]
  type: string;
  regionalStructure?: { name: string; type: string }[];
  zip?: string;
};

type SuggestResponse = {
  items: SuggestItem[];
};

type LocationSearchProps = {
  onSelect: (item: {
    name: string;
    label: string;
    location: string;
    lat: number;
    lon: number;
    bbox?: [number, number, number, number];
    city?: string;
    district?: string;
    zip?: string;
  }) => void;
  placeholder?: string;
  initialValue?: string;
};

export function LocationSearch({
  onSelect,
  placeholder = "Hledat lokalitu…",
  initialValue = "",
}: LocationSearchProps) {
  const [query, setQuery] = useState(initialValue);
  const [results, setResults] = useState<SuggestItem[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Fetch suggestions – Mapy.cz primary, Nominatim fallback
  const fetchSuggestions = useCallback(async (q: string) => {
    if (q.length < 2) {
      setResults([]);
      setOpen(false);
      return;
    }

    // Abort previous request
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);

    try {
      let items: SuggestItem[] = [];

      if (MAPY_API_KEY) {
        // ===== Mapy.cz Suggest API (primární) =====
        const params = new URLSearchParams({
          query: q,
          lang: "cs",
          limit: "8",
          type: "regional",
          locality: "cz",
          apikey: MAPY_API_KEY,
        });

        const res = await fetch(`${SUGGEST_URL}?${params}`, {
          signal: controller.signal,
          headers: { "X-Mapy-Api-Key": MAPY_API_KEY },
        });

        if (!res.ok) throw new Error(`Mapy.cz HTTP ${res.status}`);

        const data: SuggestResponse = await res.json();
        items = data.items || [];
      } else {
        // ===== Nominatim fallback (bez API klíče) =====
        const params = new URLSearchParams({
          q: q,
          format: "json",
          addressdetails: "1",
          limit: "8",
          countrycodes: "cz",
          "accept-language": "cs",
        });

        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?${params}`,
          {
            signal: controller.signal,
            headers: { "User-Agent": "Nemovizor/1.0" },
          }
        );

        if (!res.ok) throw new Error(`Nominatim HTTP ${res.status}`);

        type NominatimResult = {
          display_name: string;
          lat: string;
          lon: string;
          boundingbox: [string, string, string, string]; // [minLat, maxLat, minLon, maxLon]
          type: string;
          class: string;
          address?: {
            city?: string;
            town?: string;
            village?: string;
            municipality?: string;
            city_district?: string;
            suburb?: string;
            postcode?: string;
            state?: string;
          };
        };

        const data: NominatimResult[] = await res.json();
        items = data.map((r) => {
          const parts = r.display_name.split(", ");
          const name = parts[0];
          const location = parts.slice(1, 3).join(", ");
          const city =
            r.address?.city || r.address?.town || r.address?.village || r.address?.municipality || name;
          const bb = r.boundingbox;

          return {
            name,
            label: r.type.replace(/_/g, " "),
            location,
            position: { lat: parseFloat(r.lat), lon: parseFloat(r.lon) },
            bbox: [
              parseFloat(bb[2]), // minLon
              parseFloat(bb[0]), // minLat
              parseFloat(bb[3]), // maxLon
              parseFloat(bb[1]), // maxLat
            ] as [number, number, number, number],
            type: `regional.${r.class}`,
            regionalStructure: [
              { name: city, type: "regional.municipality" },
              ...(r.address?.city_district
                ? [{ name: r.address.city_district, type: "regional.city_part" }]
                : []),
            ],
            zip: r.address?.postcode,
          };
        });
      }

      setResults(items);
      setOpen(items.length > 0);
      setHighlightIndex(-1);
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        console.warn("Location suggest error:", err);
        setResults([]);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  // Debounced input handler
  const handleInput = (value: string) => {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchSuggestions(value), 250);
  };

  // Select item
  const handleSelect = (item: SuggestItem) => {
    // Extract city and district from regionalStructure
    let city = "";
    let district = "";
    if (item.regionalStructure) {
      for (const r of item.regionalStructure) {
        if (r.type === "regional.municipality") city = r.name;
        if (r.type === "regional.municipality_part") district = r.name;
        if (r.type === "regional.city") city = r.name;
        if (r.type === "regional.city_part") district = r.name;
      }
    }

    setQuery(item.name + (item.location ? `, ${item.location}` : ""));
    setOpen(false);
    setResults([]);

    onSelect({
      name: item.name,
      label: item.label,
      location: item.location,
      lat: item.position.lat,
      lon: item.position.lon,
      bbox: item.bbox as [number, number, number, number] | undefined,
      city: city || item.name,
      district,
      zip: item.zip,
    });
  };

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open || results.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightIndex((prev) => (prev + 1) % results.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightIndex((prev) => (prev <= 0 ? results.length - 1 : prev - 1));
    } else if (e.key === "Enter" && highlightIndex >= 0) {
      e.preventDefault();
      handleSelect(results[highlightIndex]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  // Clear
  const handleClear = () => {
    setQuery("");
    setResults([]);
    setOpen(false);
    inputRef.current?.focus();
  };

  // Icon for result type
  const getTypeIcon = (type: string) => {
    if (type.includes("city") || type.includes("municipality")) {
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="4" y="2" width="16" height="20" rx="2" />
          <path d="M9 22V12h6v10M9 6h.01M15 6h.01M9 10h.01M15 10h.01" />
        </svg>
      );
    }
    if (type.includes("street") || type.includes("address")) {
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
          <path d="M9 22V12h6v10" />
        </svg>
      );
    }
    return (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
        <circle cx="12" cy="10" r="3" />
      </svg>
    );
  };

  return (
    <div className="location-search" ref={containerRef}>
      <div className="location-search-input-wrap">
        <svg className="location-search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="8" />
          <path d="M21 21l-4.35-4.35" />
        </svg>
        <input
          ref={inputRef}
          type="text"
          className="location-search-input"
          placeholder={placeholder}
          value={query}
          onChange={(e) => handleInput(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => results.length > 0 && setOpen(true)}
        />
        {loading && (
          <div className="location-search-spinner" />
        )}
        {query && !loading && (
          <button className="location-search-clear" onClick={handleClear}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {open && results.length > 0 && (
        <div className="location-search-dropdown">
          {results.map((item, i) => (
            <button
              key={`${item.name}-${item.position.lat}-${item.position.lon}`}
              className={`location-search-item ${i === highlightIndex ? "location-search-item--active" : ""}`}
              onClick={() => handleSelect(item)}
              onMouseEnter={() => setHighlightIndex(i)}
            >
              <span className="location-search-item-icon">
                {getTypeIcon(item.type)}
              </span>
              <div className="location-search-item-text">
                <span className="location-search-item-name">{item.name}</span>
                {item.location && (
                  <span className="location-search-item-location">{item.location}</span>
                )}
              </div>
              <span className="location-search-item-label">{item.label}</span>
            </button>
          ))}
          <div className="location-search-footer">
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
