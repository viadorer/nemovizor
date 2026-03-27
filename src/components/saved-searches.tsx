"use client";

import { useState, useEffect, useRef } from "react";
import type { SavedSearch } from "@/lib/types";
import {
  getSavedSearches,
  addSavedSearch,
  removeSavedSearch,
  updateLastUsed,
  type SearchFilters,
} from "@/lib/saved-searches";
import { useT } from "@/i18n/provider";
import { track } from "@/lib/analytics";

type SavedSearchesProps = {
  currentFilters: SearchFilters;
  locationLabel?: string | null;
  onRestore: (search: SavedSearch) => void;
};

export function SavedSearches({ currentFilters, locationLabel, onRestore }: SavedSearchesProps) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [searches, setSearches] = useState<SavedSearch[]>([]);
  const ref = useRef<HTMLDivElement>(null);

  // Load on mount + when opening
  useEffect(() => {
    if (open) setSearches(getSavedSearches());
  }, [open]);

  // Close on click outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const handleSave = () => {
    const saved = addSavedSearch(currentFilters, locationLabel);
    setSearches(getSavedSearches());
    track("save_search", { location: locationLabel ?? "", listing_type: currentFilters.listingType ?? "" });
    void saved;
  };

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    removeSavedSearch(id);
    setSearches(getSavedSearches());
  };

  const handleRestore = (search: SavedSearch) => {
    updateLastUsed(search.id);
    onRestore(search);
    track("restore_search", { search_id: search.id, location: search.locationLabel ?? "" });
    setOpen(false);
  };

  const hasAny = searches.length > 0;

  return (
    <div className="saved-searches" ref={ref}>
      <button
        className={`saved-searches-trigger ${open ? "saved-searches-trigger--open" : ""}`}
        onClick={() => setOpen(!open)}
        title={t.savedSearchPanel.trigger}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
        </svg>
        {hasAny && <span className="saved-searches-badge">{searches.length}</span>}
      </button>

      {open && (
        <div className="saved-searches-dropdown">
          <div className="saved-searches-header">
            <span className="saved-searches-title">{t.savedSearchPanel.title}</span>
            <button className="saved-searches-save-btn" onClick={handleSave}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 5v14M5 12h14" />
              </svg>
              {t.savedSearchPanel.saveCurrent}
            </button>
          </div>

          {searches.length === 0 ? (
            <div className="saved-searches-empty">
              {t.savedSearchPanel.empty}
              <br />
              <span style={{ fontSize: "0.8em", opacity: 0.7 }}>
                {t.savedSearchPanel.emptyHint}
              </span>
            </div>
          ) : (
            <div className="saved-searches-list">
              {searches.map((search) => (
                <div
                  key={search.id}
                  className="saved-search-item"
                  role="button"
                  tabIndex={0}
                  onClick={() => handleRestore(search)}
                  onKeyDown={(e) => { if (e.key === "Enter") handleRestore(search); }}
                >
                  <div className="saved-search-item-content">
                    <span className="saved-search-item-name">{search.name}</span>
                    <span className="saved-search-item-date">
                      {new Date(search.createdAt).toLocaleDateString("cs")}
                    </span>
                  </div>
                  <button
                    className="saved-search-item-delete"
                    onClick={(e) => handleDelete(search.id, e)}
                    title={t.savedSearchPanel.deleteTitle}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M18 6L6 18M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
