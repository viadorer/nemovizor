"use client";

import React from "react";

export function AccordionSection({
  title,
  sectionKey,
  openSections,
  toggle,
  children,
}: {
  title: string;
  sectionKey: string;
  openSections: Set<string>;
  toggle: (key: string) => void;
  children: React.ReactNode;
}) {
  const isOpen = openSections.has(sectionKey);
  return (
    <div className={`pf-accordion${isOpen ? " pf-accordion--open" : ""}`}>
      <button
        type="button"
        className="pf-accordion__header"
        onClick={() => toggle(sectionKey)}
        aria-expanded={isOpen}
      >
        <span className="pf-accordion__title">{title}</span>
        <svg
          className="pf-accordion__chevron"
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      {isOpen && <div className="pf-accordion__body">{children}</div>}
    </div>
  );
}
