"use client";

import { useState, Suspense, type ReactNode } from "react";

export type ProfileMode = {
  id: string;
  label: string;
  count?: number;
  content: ReactNode;
};

type ProfileToggleProps = {
  modes: ProfileMode[];
  defaultMode?: string;
};

export function ProfileToggle({ modes, defaultMode }: ProfileToggleProps) {
  const [active, setActive] = useState(defaultMode ?? modes[0]?.id ?? "");

  const activeMode = modes.find((m) => m.id === active) ?? modes[0];

  if (!activeMode) return null;

  return (
    <div className="profile-toggle-wrapper">
      <div className="profile-toggle-bar">
        <div className="profile-toggle-buttons">
          {modes.map((mode) => (
            <button
              key={mode.id}
              className={`profile-toggle-btn ${activeMode.id === mode.id ? "profile-toggle-btn--active" : ""}`}
              onClick={() => setActive(mode.id)}
            >
              {mode.label}
              {mode.count !== undefined && mode.count > 0 && (
                <span className="profile-toggle-count">{mode.count.toLocaleString("cs")}</span>
              )}
            </button>
          ))}
        </div>
      </div>
      <div className={`profile-toggle-content ${activeMode.id === "nabidky" ? "profile-toggle-content--fullwidth" : ""}`}>
        <Suspense
          fallback={
            <div style={{ height: "40vh", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)" }}>
              Nacitani...
            </div>
          }
        >
          {activeMode.content}
        </Suspense>
      </div>
    </div>
  );
}
