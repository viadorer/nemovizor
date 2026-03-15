"use client";

import { useState, Suspense, type ReactNode } from "react";
import { ListingsContent } from "@/components/listings-content";

export type ProfileTab = {
  id: string;
  label: string;
  count?: number;
  content: ReactNode;
};

type ProfileTabsProps = {
  tabs: ProfileTab[];
  /** broker or agency id for the listings tab */
  brokerId?: string;
  agencyId?: string;
  defaultTab?: string;
};

export function ProfileTabs({ tabs, brokerId, agencyId, defaultTab }: ProfileTabsProps) {
  const [active, setActive] = useState(defaultTab ?? "nabidky");

  // Build final tab list: always prepend "Nabidky" tab with ListingsContent
  const allTabs: ProfileTab[] = [
    {
      id: "nabidky",
      label: "Nabidky",
      content: (
        <Suspense
          fallback={
            <div style={{ height: "70vh", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)" }}>
              Nacitani nabidek...
            </div>
          }
        >
          <ListingsContent brokerId={brokerId} agencyId={agencyId} embedded />
        </Suspense>
      ),
    },
    ...tabs,
  ];

  const activeTab = allTabs.find((t) => t.id === active) ?? allTabs[0];

  return (
    <div className="profile-tabs-wrapper">
      <div className="profile-tabs-bar">
        <div className="container">
          <div className="profile-tabs-list">
            {allTabs.map((tab) => (
              <button
                key={tab.id}
                className={`profile-tab-btn ${activeTab.id === tab.id ? "profile-tab-btn--active" : ""}`}
                onClick={() => setActive(tab.id)}
              >
                {tab.label}
                {tab.count !== undefined && tab.count > 0 && (
                  <span className="profile-tab-count">{tab.count}</span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className={`profile-tab-content ${activeTab.id === "nabidky" ? "profile-tab-content--fullwidth" : ""}`}>
        {activeTab.content}
      </div>
    </div>
  );
}
