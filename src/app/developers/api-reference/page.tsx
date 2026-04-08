"use client";

import Link from "next/link";
import { SiteHeader } from "@/components/site-header";

/**
 * Embedded OpenAPI viewer for Nemovizor.
 *
 * Uses Scalar's standalone CDN bundle — no npm dependency, no build step.
 * The Scalar script reads its spec URL + theme from an inline JSON script tag.
 */
export default function ApiReferencePage() {
  return (
    <div style={{ background: "var(--bg)", color: "var(--text)", minHeight: "100vh" }}>
      <SiteHeader />

      <header
        style={{
          padding: "1rem 1.5rem",
          borderBottom: "1px solid var(--border)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "1rem",
          background: "var(--bg-secondary)",
        }}
      >
        <Link
          href="/developers"
          style={{
            color: "var(--text-secondary)",
            textDecoration: "none",
            fontSize: "0.85rem",
            fontWeight: 600,
          }}
        >
          ← Developers
        </Link>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <a
            href="/api/openapi"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              color: "var(--accent)",
              textDecoration: "none",
              fontSize: "0.8rem",
              fontWeight: 600,
            }}
          >
            Raw OpenAPI JSON
          </a>
          <Link
            href="/developers#signup"
            style={{
              padding: "0.5rem 1rem",
              background: "var(--accent)",
              color: "var(--accent-text)",
              borderRadius: 6,
              textDecoration: "none",
              fontSize: "0.8rem",
              fontWeight: 700,
              border: "1px solid var(--accent)",
            }}
          >
            Get API key
          </Link>
        </div>
      </header>

      {/* Scalar API reference mounts itself from the <script> tag below. */}
      <div id="nemovizor-api-reference" style={{ minHeight: "calc(100vh - 140px)" }}>
        <script
          id="api-reference"
          type="application/json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              spec: { url: "/api/openapi" },
              theme: "purple",
              darkMode: true,
              layout: "modern",
              hideClientButton: false,
              metaData: {
                title: "Nemovizor API Reference",
                description:
                  "Public REST API for Nemovizor — real estate listings, search, webhooks.",
              },
              defaultHttpClient: { targetKey: "shell", clientKey: "curl" },
            }),
          }}
        />
        {/* eslint-disable-next-line @next/next/no-sync-scripts */}
        <script src="https://cdn.jsdelivr.net/npm/@scalar/api-reference" />
      </div>
    </div>
  );
}
