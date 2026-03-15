"use client";

import { useState, useRef, useEffect } from "react";

type AiSearchFilters = {
  listingType?: string;
  category?: string;
  subtype?: string;
  city?: string;
  priceMin?: number;
  priceMax?: number;
  areaMin?: number;
  areaMax?: number;
};

type AiSearchProps = {
  onFiltersReady: (filters: AiSearchFilters, explanation: string) => void;
  compact?: boolean;
};

export function AiSearch({ onFiltersReady, compact }: AiSearchProps) {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [explanation, setExplanation] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | HTMLInputElement>(null);

  // Auto-dismiss explanation after 8s
  useEffect(() => {
    if (!explanation) return;
    const t = setTimeout(() => setExplanation(null), 8000);
    return () => clearTimeout(t);
  }, [explanation]);

  const handleSubmit = async () => {
    const q = query.trim();
    if (!q || q.length < 3 || loading) return;

    setLoading(true);
    setError(null);
    setExplanation(null);

    try {
      const res = await fetch("/api/ai-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: q }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "AI hledání selhalo");
      }

      const data = await res.json();
      const filters: AiSearchFilters = data.filters || {};
      const expl: string = data.explanation || "";

      setExplanation(expl);
      onFiltersReady(filters, expl);
      setQuery("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Chyba AI hledání");
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className={`ai-search ${compact ? "ai-search--compact" : ""}`}>
      <div className={`ai-search-input-wrapper ${!compact ? "ai-search-input-wrapper--hero" : ""}`}>
        <svg className="ai-search-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 3v2m0 14v2m-7-9H3m18 0h-2M5.6 5.6l1.4 1.4m9.9 9.9l1.4 1.4M5.6 18.4l1.4-1.4m9.9-9.9l1.4-1.4" />
          <circle cx="12" cy="12" r="4" />
        </svg>
        {compact ? (
          <input
            ref={inputRef as React.RefObject<HTMLInputElement>}
            className="ai-search-input"
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Popiste, co hledáte..."
            disabled={loading}
          />
        ) : (
          <textarea
            ref={inputRef as React.RefObject<HTMLTextAreaElement>}
            className="ai-search-input ai-search-textarea"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSubmit();
              }
            }}
            placeholder={'Popiste vlastními slovy, co hledáte...\nnapř. "Byt 3+kk v Praze do 8M" nebo "Dům se zahradou na Moravě"'}
            disabled={loading}
            rows={3}
          />
        )}
        <button
          className="ai-search-submit"
          onClick={handleSubmit}
          disabled={loading || query.trim().length < 3}
        >
          {loading ? (
            <span className="ai-search-spinner" />
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 2L11 13" />
              <path d="M22 2l-7 20-4-9-9-4 20-7z" />
            </svg>
          )}
        </button>
      </div>

      {explanation && (
        <div className="ai-search-explanation">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
            <path d="M22 4L12 14.01l-3-3" />
          </svg>
          {explanation}
          <button className="ai-search-explanation-close" onClick={() => setExplanation(null)}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {error && (
        <div className="ai-search-error">
          {error}
          <button className="ai-search-explanation-close" onClick={() => setError(null)}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}
