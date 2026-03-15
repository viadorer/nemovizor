"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type ListingNavProps = {
  currentSlug: string;
};

export function ListingNav({ currentSlug }: ListingNavProps) {
  const [prevSlug, setPrevSlug] = useState<string | null>(null);
  const [nextSlug, setNextSlug] = useState<string | null>(null);
  const [position, setPosition] = useState<string | null>(null);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("listing-slugs");
      if (!raw) return;
      const slugs: string[] = JSON.parse(raw);
      const idx = slugs.indexOf(currentSlug);
      if (idx === -1) return;
      setPosition(`${idx + 1} / ${slugs.length}`);
      if (idx > 0) setPrevSlug(slugs[idx - 1]);
      if (idx < slugs.length - 1) setNextSlug(slugs[idx + 1]);
    } catch {}
  }, [currentSlug]);

  if (!prevSlug && !nextSlug) return null;

  return (
    <div className="listing-nav">
      {prevSlug ? (
        <Link href={`/nemovitost/${prevSlug}`} className="listing-nav-btn">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M15 18l-6-6 6-6" />
          </svg>
          Predchozi
        </Link>
      ) : (
        <span />
      )}
      {position && <span className="listing-nav-pos">{position}</span>}
      {nextSlug ? (
        <Link href={`/nemovitost/${nextSlug}`} className="listing-nav-btn">
          Dalsi
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 18l6-6-6-6" />
          </svg>
        </Link>
      ) : (
        <span />
      )}
    </div>
  );
}
