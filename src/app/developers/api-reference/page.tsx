"use client";

import Link from "next/link";
import { useEffect } from "react";

/**
 * Embedded OpenAPI viewer for Nemovizor.
 *
 * Uses Scalar's standalone CDN bundle — no npm dependency, no build step.
 * The script registers a custom element / API reference root that reads
 * the spec URL from a script tag.
 */
export default function ApiReferencePage() {
  useEffect(() => {
    // Tag the body so global app styles don't bleed into the dark theme.
    document.body.style.background = "#0a0a0f";
    return () => {
      document.body.style.background = "";
    };
  }, []);

  return (
    <main style={{ background: "#0a0a0f", color: "#e5e7eb", minHeight: "100vh" }}>
      <header
        style={{
          padding: "1rem 1.5rem",
          borderBottom: "1px solid rgba(255,255,255,0.05)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "1rem",
        }}
      >
        <Link
          href="/developers"
          style={{
            color: "#9ca3af",
            textDecoration: "none",
            fontSize: "0.85rem",
            fontWeight: 600,
          }}
        >
          ← Back to Developers
        </Link>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <a
            href="/api/openapi"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              color: "#a78bfa",
              textDecoration: "none",
              fontSize: "0.8rem",
              fontWeight: 600,
            }}
          >
            Raw OpenAPI JSON ↗
          </a>
          <Link
            href="/developers#signup"
            style={{
              padding: "0.5rem 1rem",
              background: "linear-gradient(135deg, #7c3aed 0%, #a78bfa 100%)",
              color: "white",
              borderRadius: 6,
              textDecoration: "none",
              fontSize: "0.8rem",
              fontWeight: 600,
            }}
          >
            Get API key
          </Link>
        </div>
      </header>

      {/* Scalar API reference auto-renders into this slot via the <script> below. */}
      <div id="nemovizor-api-reference" style={{ minHeight: "calc(100vh - 60px)" }}>
        <script
          id="api-reference"
          type="application/json"
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              spec: { url: "/api/openapi" },
              theme: "purple",
              darkMode: true,
              layout: "modern",
              hideClientButton: false,
              metaData: {
                title: "Nemovizor API Reference",
                description: "Public REST API for Nemovizor — real estate listings, search, webhooks.",
              },
              defaultHttpClient: {
                targetKey: "shell",
                clientKey: "curl",
              },
            }),
          }}
        />
        <script
          src="https://cdn.jsdelivr.net/npm/@scalar/api-reference"
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          {...({ async: true } as any)}
        />
      </div>
    </main>
  );
}
