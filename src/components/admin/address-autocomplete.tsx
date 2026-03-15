"use client";

import { useState, useEffect, useRef } from "react";

export type MapySuggestion = {
  name: string;
  label: string;
  position: { lat: number; lon: number };
  regionalStructure: { type: string; name: string }[];
};

export function AddressAutocomplete({
  onSelect,
  isLand,
}: {
  onSelect: (s: MapySuggestion) => void;
  isLand: boolean;
}) {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<MapySuggestion[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const apiKey = typeof window !== "undefined"
    ? (process.env.NEXT_PUBLIC_MAPYCZ_API_KEY ?? "")
    : "";

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function handleChange(val: string) {
    setQuery(val);
    if (timerRef.current) clearTimeout(timerRef.current);

    if (!apiKey || val.trim().length < 3) {
      setSuggestions([]);
      setShowDropdown(false);
      return;
    }

    timerRef.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `https://api.mapy.cz/v1/suggest?lang=cs&limit=5&type=regional.address&query=${encodeURIComponent(val)}`,
          { headers: { "X-Mapy-Api-Key": apiKey } }
        );
        if (!res.ok) return;
        const data = await res.json();
        setSuggestions(data.items || []);
        setShowDropdown(true);
      } catch {
        /* silently fail */
      }
    }, 300);
  }

  function handleSelect(s: MapySuggestion) {
    setQuery(s.label);
    setShowDropdown(false);
    onSelect(s);
  }

  if (!apiKey) {
    return (
      <div className="admin-form-group">
        <label>{"Vyhled\u00e1v\u00e1n\u00ed adresy"}</label>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={"Zadejte adresu ru\u010dn\u011b n\u00ed\u017ee..."}
        />
        {isLand && (
          <p className="pf-hint">{"U pozemk\u016f adresa nemus\u00ed existovat \u2014 zadejte \u00fadaje ru\u010dn\u011b."}</p>
        )}
      </div>
    );
  }

  return (
    <div className="admin-form-group pf-address-suggest" ref={wrapRef}>
      <label>
        {"Vyhledat adresu (Mapy.cz)"}
      </label>
      <input
        type="text"
        value={query}
        onChange={(e) => handleChange(e.target.value)}
        placeholder={"Za\u010dn\u011bte ps\u00e1t adresu..."}
        onFocus={() => { if (suggestions.length > 0) setShowDropdown(true); }}
      />
      {isLand && (
        <p className="pf-hint">{"U pozemk\u016f adresa nemus\u00ed existovat \u2014 zadejte \u00fadaje ru\u010dn\u011b."}</p>
      )}
      {showDropdown && suggestions.length > 0 && (
        <ul className="pf-address-suggest__dropdown">
          {suggestions.map((s, i) => (
            <li key={i}>
              <button type="button" onClick={() => handleSelect(s)}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                  <circle cx="12" cy="10" r="3" />
                </svg>
                <span>{s.label}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
