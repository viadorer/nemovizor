"use client";

import { useState } from "react";
import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

// ─── Content ───────────────────────────────────────────────────────────────

const FEATURES = [
  {
    title: "72 655 aktivních nabídek",
    body: "Reálná data z 8 zdrojů napříč 20 zeměmi: Sreality, Bienici, Fotocasa, Otodom, Idealista, Realmen a další. Aktualizováno průběžně.",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <path d="M3 9h18" />
        <path d="M9 21V9" />
      </svg>
    ),
  },
  {
    title: "AI search v jakémkoli jazyce",
    body: "Pošli volný text (např. 'Byt 2+kk v Praze do 8 milionů') a dostaneš strukturované filtry. Funguje česky, slovensky, anglicky, francouzsky, italsky, španělsky, německy.",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2a4 4 0 0 1 4 4v2" />
        <path d="M8 8V6a4 4 0 0 1 4-4" />
        <rect x="5" y="8" width="14" height="8" rx="2" />
        <path d="M12 16v4" />
        <path d="M8 20h8" />
        <circle cx="9" cy="12" r="0.5" fill="currentColor" />
        <circle cx="15" cy="12" r="0.5" fill="currentColor" />
      </svg>
    ),
  },
  {
    title: "Webhooks místo pollování",
    body: "Subscribe na property.created, property.price_changed atd. HMAC-SHA256 podepsané doručení do 5 minut od mutace v DB.",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="18" cy="18" r="3" />
        <circle cx="6" cy="6" r="3" />
        <path d="M6 9v9a3 3 0 0 0 3 3h6" />
        <path d="M9 6h9a3 3 0 0 1 3 3v6" />
      </svg>
    ),
  },
  {
    title: "MCP server pro Claude / Cursor",
    body: "8 tools přímo v Claude Desktop. Žádné HTML scraping, žádné parsování, jen strukturovaná data od prvního dotazu.",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <path d="M8 10l4 4 4-4" />
        <path d="M12 14V4" />
      </svg>
    ),
  },
  {
    title: "Cursor pagination + detail",
    body: "Stable iteration přes celou DB bez skipping/duplikátů. GET single property by id nebo SEO slug.",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <path d="M14 2v6h6" />
        <path d="M9 13h6" />
        <path d="M9 17h6" />
      </svg>
    ),
  },
  {
    title: "OpenAPI 3.1 + dokumentace",
    body: "Auto-generovaný spec ze Zod schémat. Importuj do Postman/Insomnia/Swagger a vygeneruj si SDK pro libovolný jazyk.",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
      </svg>
    ),
  },
];

const TIERS = [
  {
    name: "Free",
    price: "0 Kč",
    period: "měsíčně",
    rateLimit: "60 req/min",
    description: "Pro experimenty, hobby projekty a AI agenty.",
    features: [
      "Anonymous přístup, žádný API klíč",
      "Všechny veřejné endpointy /api/v1/*",
      "MCP server pro Claude Desktop",
      "60 req/min/IP",
    ],
    cta: "Začít teď",
    href: "https://nemovizor.vercel.app/api/v1/properties?limit=5",
    primary: false,
  },
  {
    name: "Starter",
    price: "990 Kč",
    period: "měsíčně",
    rateLimit: "300 req/min",
    description: "Malá realitní kancelář, makléřův web, vlastní mobilní aplikace.",
    features: [
      "API klíč s vyšším limitem",
      "Webhook subscriptions (max 10)",
      "Per-key audit log",
      "Email support do 48 h",
      "300 req/min na klíč",
    ],
    cta: "Požádat o klíč",
    href: "#signup",
    primary: true,
  },
  {
    name: "Pro",
    price: "4 900 Kč",
    period: "měsíčně",
    rateLimit: "2 000 req/min",
    description: "Středně velký portál, agentura, konkurenční srovnávač.",
    features: [
      "Vše z Starter",
      "2 000 req/min",
      "Webhook subscriptions (max 50)",
      "write:broker scope",
      "Email support do 24 h",
    ],
    cta: "Požádat o klíč",
    href: "#signup",
    primary: false,
  },
  {
    name: "Enterprise",
    price: "od 19 900 Kč",
    period: "měsíčně",
    rateLimit: "Custom",
    description: "Banky, developeři, srovnávače, white-label platformy.",
    features: [
      "Custom rate limit + SLA 99.9 %",
      "Dedicated subdomain",
      "Bulk export, multi-region",
      "Slack/email support do 4 h",
      "Volitelně: revenue share",
    ],
    cta: "Kontaktovat",
    href: "#signup",
    primary: false,
  },
];

const QUICKSTART_CURL = `curl "https://nemovizor.vercel.app/api/v1/properties?country=cz&limit=5"`;

const QUICKSTART_AI_SEARCH = `curl -X POST https://nemovizor.vercel.app/api/v1/ai-search \\
  -H "Content-Type: application/json" \\
  -d '{"query":"Byt 3+kk v Praze do 8 milionů"}'`;

const QUICKSTART_NODE = `// Plain fetch — no SDK needed
const res = await fetch(
  "https://nemovizor.vercel.app/api/v1/properties?listingType=sale&category=apartment&city=Praha",
  { headers: { Authorization: "Bearer nvz_xxx" } } // optional, raises rate limit
);
const { data, total, nextCursor } = await res.json();`;

const QUICKSTART_PYTHON = `import requests

r = requests.get(
    "https://nemovizor.vercel.app/api/v1/properties",
    params={"country": "cz", "category": "apartment", "limit": 10},
    headers={"Authorization": "Bearer nvz_xxx"},  # optional
)
print(r.json()["total"], "matching listings")`;

// ─── Page ──────────────────────────────────────────────────────────────────

export default function DevelopersPage() {
  return (
    <div style={{ background: "var(--bg)", color: "var(--text)", minHeight: "100vh" }}>
      <SiteHeader />
      <Hero />
      <Features />
      <Quickstart />
      <Pricing />
      <SignupForm />
      <SiteFooter />
    </div>
  );
}

// ─── Sections ──────────────────────────────────────────────────────────────

function Hero() {
  return (
    <section
      style={{
        padding: "6rem 1.5rem 4rem",
        maxWidth: 1200,
        margin: "0 auto",
        textAlign: "center",
      }}
    >
      <div
        style={{
          display: "inline-block",
          padding: "0.4rem 1rem",
          background: "var(--bg-card)",
          color: "var(--accent)",
          borderRadius: 999,
          fontSize: "0.7rem",
          fontWeight: 700,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          marginBottom: "1.5rem",
          border: "1px solid var(--border)",
        }}
      >
        Nemovizor API · v1 · Public preview
      </div>
      <h1
        style={{
          fontSize: "clamp(2rem, 5vw, 3.75rem)",
          fontWeight: 800,
          lineHeight: 1.1,
          marginBottom: "1.5rem",
          color: "var(--text)",
        }}
      >
        Postav realitní aplikaci<br />
        z <span style={{ color: "var(--accent)" }}>72 655 nabídek</span>
      </h1>
      <p
        style={{
          fontSize: "1.125rem",
          color: "var(--text-secondary)",
          maxWidth: 720,
          margin: "0 auto 2.5rem",
          lineHeight: 1.6,
        }}
      >
        Headless real-estate platforma. REST API, webhooks, AI search, MCP server.
        Pro AI agenty, broker CRM, mobilní apky, vlastní portály a všechno mezi tím.
      </p>
      <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
        <Link
          href="/developers/api-reference"
          style={primaryButton}
        >
          API reference
        </Link>
        <a href="#quickstart" style={secondaryButton}>
          Quick start
        </a>
        <a href="#signup" style={outlineButton}>
          Požádat o API klíč
        </a>
      </div>

      {/* Stats strip */}
      <div
        style={{
          marginTop: "4rem",
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
          gap: "1rem",
          maxWidth: 800,
          marginLeft: "auto",
          marginRight: "auto",
        }}
      >
        {[
          { value: "72 655", label: "Aktivních nabídek" },
          { value: "20", label: "Zemí" },
          { value: "8", label: "Datových zdrojů" },
          { value: "9", label: "API endpointů" },
          { value: "4", label: "Webhook events" },
        ].map((s) => (
          <div
            key={s.label}
            style={{
              padding: "1rem",
              background: "var(--bg-card)",
              border: "1px solid var(--border)",
              borderRadius: 8,
            }}
          >
            <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--text)" }}>{s.value}</div>
            <div
              style={{
                fontSize: "0.7rem",
                color: "var(--text-muted)",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}
            >
              {s.label}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function Features() {
  return (
    <section style={{ padding: "4rem 1.5rem", maxWidth: 1200, margin: "0 auto" }}>
      <h2
        style={{
          fontSize: "1.75rem",
          fontWeight: 700,
          textAlign: "center",
          marginBottom: "3rem",
          color: "var(--text)",
        }}
      >
        Co dostaneš
      </h2>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: "1.25rem",
        }}
      >
        {FEATURES.map((f) => (
          <div
            key={f.title}
            style={{
              padding: "1.5rem",
              background: "var(--bg-card)",
              border: "1px solid var(--border)",
              borderRadius: 12,
            }}
          >
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: 48,
                height: 48,
                borderRadius: 10,
                background: "var(--bg-secondary)",
                color: "var(--accent)",
                marginBottom: "1rem",
              }}
            >
              {f.icon}
            </div>
            <h3 style={{ fontSize: "1.05rem", fontWeight: 600, marginBottom: "0.5rem", color: "var(--text)" }}>
              {f.title}
            </h3>
            <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", lineHeight: 1.5 }}>{f.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function Quickstart() {
  const [tab, setTab] = useState<"curl" | "ai" | "node" | "python">("curl");
  const samples = {
    curl: { label: "cURL · search", code: QUICKSTART_CURL },
    ai: { label: "cURL · AI search", code: QUICKSTART_AI_SEARCH },
    node: { label: "Node.js / TS", code: QUICKSTART_NODE },
    python: { label: "Python", code: QUICKSTART_PYTHON },
  };
  return (
    <section id="quickstart" style={{ padding: "4rem 1.5rem", maxWidth: 900, margin: "0 auto" }}>
      <h2
        style={{
          fontSize: "1.75rem",
          fontWeight: 700,
          textAlign: "center",
          marginBottom: "0.5rem",
          color: "var(--text)",
        }}
      >
        Quick start
      </h2>
      <p style={{ textAlign: "center", color: "var(--text-secondary)", marginBottom: "2rem" }}>
        Bez registrace, hned. API klíč jen pro vyšší rate limit.
      </p>

      <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
        {(Object.keys(samples) as Array<keyof typeof samples>).map((k) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            style={{
              padding: "0.6rem 1rem",
              background: tab === k ? "var(--bg-card)" : "transparent",
              border: "1px solid var(--border)",
              borderBottom: tab === k ? "1px solid var(--bg-card)" : "1px solid var(--border)",
              borderTopLeftRadius: 6,
              borderTopRightRadius: 6,
              color: tab === k ? "var(--text)" : "var(--text-muted)",
              fontSize: "0.8rem",
              fontWeight: 600,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            {samples[k].label}
          </button>
        ))}
      </div>

      <pre
        style={{
          margin: 0,
          padding: "1.25rem",
          background: "var(--bg-card)",
          border: "1px solid var(--border)",
          borderRadius: "0 6px 6px 6px",
          overflow: "auto",
          fontSize: "0.8rem",
          lineHeight: 1.5,
          color: "var(--text)",
        }}
      >
        <code>{samples[tab].code}</code>
      </pre>

      <div style={{ marginTop: "1.5rem", textAlign: "center" }}>
        <Link
          href="/developers/api-reference"
          style={{
            color: "var(--accent)",
            textDecoration: "none",
            fontSize: "0.9rem",
            fontWeight: 600,
          }}
        >
          Plný API reference →
        </Link>
      </div>
    </section>
  );
}

function Pricing() {
  return (
    <section style={{ padding: "4rem 1.5rem", maxWidth: 1200, margin: "0 auto" }}>
      <h2
        style={{
          fontSize: "1.75rem",
          fontWeight: 700,
          textAlign: "center",
          marginBottom: "0.5rem",
          color: "var(--text)",
        }}
      >
        Pricing
      </h2>
      <p style={{ textAlign: "center", color: "var(--text-secondary)", marginBottom: "3rem" }}>
        Free tier zdarma, navždy. Vyšší tier znamená vyšší rate limit a bonus features.
      </p>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
          gap: "1rem",
        }}
      >
        {TIERS.map((tier) => (
          <div
            key={tier.name}
            style={{
              padding: "1.5rem",
              background: "var(--bg-card)",
              border: tier.primary
                ? "1px solid var(--accent)"
                : "1px solid var(--border)",
              borderRadius: 12,
              position: "relative",
            }}
          >
            {tier.primary && (
              <div
                style={{
                  position: "absolute",
                  top: -10,
                  left: "50%",
                  transform: "translateX(-50%)",
                  background: "var(--accent)",
                  color: "var(--accent-text)",
                  padding: "0.25rem 0.75rem",
                  fontSize: "0.65rem",
                  fontWeight: 700,
                  borderRadius: 999,
                  textTransform: "uppercase",
                  letterSpacing: "0.1em",
                }}
              >
                Doporučeno
              </div>
            )}
            <div
              style={{
                fontSize: "0.75rem",
                color: "var(--text-muted)",
                textTransform: "uppercase",
                letterSpacing: "0.1em",
                fontWeight: 700,
              }}
            >
              {tier.name}
            </div>
            <div style={{ marginTop: "0.5rem", display: "flex", alignItems: "baseline", gap: 6 }}>
              <span style={{ fontSize: "1.75rem", fontWeight: 800, color: "var(--text)" }}>{tier.price}</span>
              <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>/ {tier.period}</span>
            </div>
            <div
              style={{
                fontSize: "0.7rem",
                color: "var(--accent)",
                fontFamily: "monospace",
                marginTop: "0.4rem",
              }}
            >
              {tier.rateLimit}
            </div>
            <p style={{ fontSize: "0.8rem", color: "var(--text-secondary)", margin: "0.75rem 0 1rem", lineHeight: 1.4 }}>
              {tier.description}
            </p>
            <ul style={{ listStyle: "none", padding: 0, margin: 0, marginBottom: "1rem" }}>
              {tier.features.map((f) => (
                <li
                  key={f}
                  style={{
                    fontSize: "0.75rem",
                    color: "var(--text)",
                    padding: "0.3rem 0",
                    paddingLeft: "1.5rem",
                    position: "relative",
                  }}
                >
                  <span
                    aria-hidden
                    style={{
                      position: "absolute",
                      left: 0,
                      top: "0.35rem",
                      width: 14,
                      height: 14,
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "var(--accent)",
                    }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </span>
                  {f}
                </li>
              ))}
            </ul>
            <a
              href={tier.href}
              target={tier.href.startsWith("http") ? "_blank" : undefined}
              rel={tier.href.startsWith("http") ? "noopener noreferrer" : undefined}
              style={tier.primary ? primaryButton : secondaryButton}
            >
              {tier.cta}
            </a>
          </div>
        ))}
      </div>
    </section>
  );
}

function SignupForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [company, setCompany] = useState("");
  const [tier, setTier] = useState("Starter (990 Kč/měs)");
  const [useCase, setUseCase] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          phone: phone.trim() || undefined,
          intent: "developer-api",
          source: "developers-page",
          note: `Tier: ${tier}\nCompany: ${company || "—"}\nUse case: ${useCase || "—"}`,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error?.message || `HTTP ${res.status}`);
      }
      setSubmitted(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Nepodařilo se odeslat");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section id="signup" style={{ padding: "4rem 1.5rem 6rem", maxWidth: 720, margin: "0 auto" }}>
      <h2
        style={{
          fontSize: "1.75rem",
          fontWeight: 700,
          textAlign: "center",
          marginBottom: "0.5rem",
          color: "var(--text)",
        }}
      >
        Požádat o API klíč
      </h2>
      <p style={{ textAlign: "center", color: "var(--text-secondary)", marginBottom: "2rem" }}>
        Vyplň formulář, ozveme se do 24 hodin s API klíčem a pricing detaily. Free tier funguje bez registrace — využij ho na experimenty hned teď.
      </p>

      {submitted ? (
        <div
          style={{
            padding: "2rem",
            background: "var(--bg-card)",
            border: "1px solid var(--accent)",
            borderRadius: 12,
            textAlign: "center",
          }}
        >
          <div style={{ fontWeight: 700, marginBottom: "0.5rem", color: "var(--text)", fontSize: "1.1rem" }}>
            Odesláno
          </div>
          <div style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>
            Ozveme se ti na <strong style={{ color: "var(--text)" }}>{email}</strong> do 24 hodin s dalšími kroky.
          </div>
        </div>
      ) : (
        <form
          onSubmit={onSubmit}
          style={{
            padding: "2rem",
            background: "var(--bg-card)",
            border: "1px solid var(--border)",
            borderRadius: 12,
            display: "grid",
            gap: "1rem",
          }}
        >
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
            <Field label="Jméno *" value={name} onChange={setName} required />
            <Field label="Email *" type="email" value={email} onChange={setEmail} required />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
            <Field label="Telefon" value={phone} onChange={setPhone} />
            <Field label="Firma" value={company} onChange={setCompany} />
          </div>
          <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={labelStyle}>Plánovaný tier</span>
            <select
              value={tier}
              onChange={(e) => setTier(e.target.value)}
              style={inputStyle}
            >
              <option>Starter (990 Kč/měs)</option>
              <option>Pro (4 900 Kč/měs)</option>
              <option>Enterprise (od 19 900 Kč/měs)</option>
              <option>Zatím nevím</option>
            </select>
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={labelStyle}>Use case (krátce)</span>
            <textarea
              value={useCase}
              onChange={(e) => setUseCase(e.target.value)}
              rows={3}
              placeholder="např. broker CRM s real-time sync, mobilní aplikace pro hledání bytů, AI asistent s cenovými alerty…"
              style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit" }}
            />
          </label>

          {error && (
            <div
              style={{
                padding: "0.6rem",
                background: "var(--bg-secondary)",
                border: "1px solid var(--border)",
                borderLeft: "3px solid #ef4444",
                borderRadius: 6,
                color: "#fca5a5",
                fontSize: "0.8rem",
              }}
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting || !name.trim() || !email.trim()}
            style={{
              ...primaryButton,
              padding: "0.875rem",
              border: "none",
              cursor: submitting ? "wait" : "pointer",
              opacity: submitting || !name.trim() || !email.trim() ? 0.5 : 1,
              fontFamily: "inherit",
            }}
          >
            {submitting ? "Odesílám…" : "Odeslat žádost"}
          </button>
        </form>
      )}
    </section>
  );
}

// ─── Shared helpers ────────────────────────────────────────────────────────

function Field({
  label,
  value,
  onChange,
  type = "text",
  required = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
}) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <span style={labelStyle}>{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        style={inputStyle}
      />
    </label>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────

const primaryButton: React.CSSProperties = {
  display: "inline-block",
  padding: "0.75rem 1.5rem",
  background: "var(--accent)",
  color: "var(--accent-text)",
  borderRadius: 8,
  fontWeight: 700,
  textDecoration: "none",
  fontSize: "0.85rem",
  border: "1px solid var(--accent)",
  textAlign: "center",
};

const secondaryButton: React.CSSProperties = {
  display: "inline-block",
  padding: "0.75rem 1.5rem",
  background: "var(--bg-card)",
  color: "var(--text)",
  borderRadius: 8,
  fontWeight: 600,
  textDecoration: "none",
  fontSize: "0.85rem",
  border: "1px solid var(--border)",
  textAlign: "center",
};

const outlineButton: React.CSSProperties = {
  display: "inline-block",
  padding: "0.75rem 1.5rem",
  background: "transparent",
  color: "var(--accent)",
  borderRadius: 8,
  fontWeight: 600,
  textDecoration: "none",
  fontSize: "0.85rem",
  border: "1px solid var(--accent)",
  textAlign: "center",
};

const labelStyle: React.CSSProperties = {
  fontSize: "0.7rem",
  fontWeight: 700,
  color: "var(--text-muted)",
  textTransform: "uppercase",
  letterSpacing: "0.1em",
};

const inputStyle: React.CSSProperties = {
  padding: "0.7rem",
  background: "var(--bg-input)",
  border: "1px solid var(--border)",
  borderRadius: 6,
  color: "var(--text)",
  fontSize: "0.85rem",
  fontFamily: "inherit",
};
