"use client";

import { useState, type ReactNode } from "react";

export type DetailTab = {
  id: string;
  label: string;
  count?: number;
  content: ReactNode;
};

type DetailTabsProps = {
  tabs: DetailTab[];
  defaultTab?: string;
  /** Content rendered ABOVE the tab bar (e.g. profile info) */
  headerContent?: ReactNode;
};

/**
 * Simple tab switcher for detail pages.
 * headerContent renders above the tab bar.
 * Each tab carries its own pre-rendered content.
 */
export function DetailTabs({ tabs, defaultTab, headerContent }: DetailTabsProps) {
  const [active, setActive] = useState(defaultTab ?? tabs[0]?.id ?? "");
  const activeTab = tabs.find((t) => t.id === active) ?? tabs[0];

  return (
    <>
      {headerContent && (
        <div className="detail-header-content">
          {headerContent}
        </div>
      )}
      <div className="detail-tabs-bar">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={`detail-tab-btn ${active === tab.id ? "detail-tab-btn--active" : ""}`}
            onClick={() => setActive(tab.id)}
          >
            {tab.label}
            {tab.count !== undefined && tab.count > 0 && (
              <span className="detail-tab-count">{tab.count.toLocaleString("cs")}</span>
            )}
          </button>
        ))}
      </div>
      <div className="detail-content">
        {activeTab?.content}
      </div>
    </>
  );
}
