"use client";

import { useState, useRef, useEffect } from "react";
import { useLocale } from "@/i18n/provider";

const LANGUAGES = [
  { code: "cs", label: "CZ", flag: "🇨🇿" },
  { code: "en", label: "EN", flag: "🇬🇧" },
  { code: "fr", label: "FR", flag: "🇫🇷" },
];

export function LanguageSwitcher() {
  const { locale, setLocale } = useLocale();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const current = LANGUAGES.find((l) => l.code === locale) || LANGUAGES[0];

  return (
    <div className="lang-switcher" ref={ref}>
      <button
        className="lang-switcher-btn"
        onClick={() => setOpen(!open)}
        type="button"
        aria-label="Language"
      >
        <span className="lang-switcher-label">{current.label}</span>
      </button>
      {open && (
        <div className="lang-switcher-dropdown">
          {LANGUAGES.map((lang) => (
            <button
              key={lang.code}
              className={`lang-switcher-option ${lang.code === locale ? "lang-switcher-option--active" : ""}`}
              onClick={() => { setLocale(lang.code); setOpen(false); }}
              type="button"
            >
              <span>{lang.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
