"use client";

import { useState } from "react";
import Link from "next/link";

const FEATURES = [
  {
    title: "72 655 aktivních nabídek",
    body: "Reálná data z 8 zdrojů napříč 20 zeměmi: Sreality, Bienici, Fotocasa, Otodom, Idealista, Realmen a další. Aktualizováno průběžně.",
    icon: "📊",
  },
  {
    title: "AI search v jakémkoli jazyce",
    body: "Pošli volný text (např. 'Byt 2+kk v Praze do 8 milionů') a dostaneš strukturované filtry. Funguje česky, slovensky, anglicky, francouzsky, italsky, španělsky, německy.",
    icon: "🤖",
  },
  {
    title: "Webhooks místo pollování",
    body: "Subscribe na property.created, property.price_changed atd. HMAC-SHA256 podepsané doručení do 5 minut od mutace v DB.",
    icon: "🔔",
  },
  {
    title: "MCP server pro Claude / Cursor",
    body: "8 tools přímo v Claude Desktop. Žádné HTML scraping, žádné parsování, jen strukturovaná data od prvního dotazu.",
    icon: "🧠",
  },
  {
    title: "Cursor pagination + detail",
    body: "Stable iteration přes celou DB bez skipping/duplikátů. GET single property by id nebo SEO slug.",
    icon: "📄",
  },
  {
    title: "OpenAPI 3.1 + dokumentace",
    body: "Auto-generovaný spec ze Zod schémat. Importuj do Postman/Insomnia/Swagger a vygeneruj si SDK pro libovolný jazyk.",
    icon: "📘",
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
      "write:broker scope (CRUD vlastních inzerátů)",
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
      "Volitelně: revenue share přes Nemovizor brokerskou síť",
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

const QUICKSTART_NODE = `import { Nemovizor } from "nemovizor-sdk"; // coming soon

// Or just use fetch:
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

export default function DevelopersPage() {
  return (
    <main style={{ background: "#0a0a0f", color: "#e5e7eb", minHeight: "100vh" }}>
      <Hero />
      <Features />
      <Quickstart />
      <Pricing />
      <SignupForm />
      <Footer />
    </main>
  );
}

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
          background: "rgba(124, 58, 237, 0.15)",
          color: "#a78bfa",
          borderRadius: 999,
          fontSize: "0.75rem",
          fontWeight: 600,
          letterSpacing: "0.05em",
          textTransform: "uppercase",
          marginBottom: "1.5rem",
          border: "1px solid rgba(124, 58, 237, 0.3)",
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
          background: "linear-gradient(135deg, #fff 0%, #a78bfa 100%)",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          backgroundClip: "text",
        }}
      >
        Postav realitní aplikaci<br />
        z <span style={{ WebkitTextFillColor: "#a78bfa" }}>72 655 nabídek</span>
      </h1>
      <p
        style={{
          fontSize: "1.125rem",
          color: "#9ca3af",
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
          href="/api/openapi"
          style={{
            padding: "0.875rem 1.75rem",
            background: "linear-gradient(135deg, #7c3aed 0%, #a78bfa 100%)",
            color: "white",
            borderRadius: 8,
            fontWeight: 600,
            textDecoration: "none",
            fontSize: "0.95rem",
            boxShadow: "0 4px 24px rgba(124, 58, 237, 0.4)",
          }}
        >
          OpenAPI spec →
        </Link>
        <a
          href="#quickstart"
          style={{
            padding: "0.875rem 1.75rem",
            background: "rgba(255,255,255,0.05)",
            color: "white",
            borderRadius: 8,
            fontWeight: 600,
            textDecoration: "none",
            fontSize: "0.95rem",
            border: "1px solid rgba(255,255,255,0.1)",
          }}
        >
          Quick start
        </a>
        <a
          href="#signup"
          style={{
            padding: "0.875rem 1.75rem",
            background: "transparent",
            color: "#a78bfa",
            borderRadius: 8,
            fontWeight: 600,
            textDecoration: "none",
            fontSize: "0.95rem",
            border: "1px solid rgba(124, 58, 237, 0.5)",
          }}
        >
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
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.05)",
              borderRadius: 8,
            }}
          >
            <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "#fff" }}>{s.value}</div>
            <div style={{ fontSize: "0.7rem", color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>
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
          color: "#fff",
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
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.06)",
              borderRadius: 12,
            }}
          >
            <div style={{ fontSize: "2rem", marginBottom: "0.75rem" }}>{f.icon}</div>
            <h3 style={{ fontSize: "1.05rem", fontWeight: 600, marginBottom: "0.5rem", color: "#fff" }}>
              {f.title}
            </h3>
            <p style={{ fontSize: "0.85rem", color: "#9ca3af", lineHeight: 1.5 }}>{f.body}</p>
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
    <section
      id="quickstart"
      style={{ padding: "4rem 1.5rem", maxWidth: 900, margin: "0 auto" }}
    >
      <h2
        style={{
          fontSize: "1.75rem",
          fontWeight: 700,
          textAlign: "center",
          marginBottom: "0.5rem",
          color: "#fff",
        }}
      >
        Quick start
      </h2>
      <p style={{ textAlign: "center", color: "#9ca3af", marginBottom: "2rem" }}>
        Bez registrace, hned. API klíč jen pro vyšší rate limit.
      </p>

      {/* Tab buttons */}
      <div style={{ display: "flex", gap: 4, marginBottom: 0, flexWrap: "wrap" }}>
        {(Object.keys(samples) as Array<keyof typeof samples>).map((k) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            style={{
              padding: "0.6rem 1rem",
              background: tab === k ? "#1f2937" : "transparent",
              border: "1px solid rgba(255,255,255,0.08)",
              borderBottom: tab === k ? "1px solid #1f2937" : "1px solid rgba(255,255,255,0.08)",
              borderTopLeftRadius: 6,
              borderTopRightRadius: 6,
              color: tab === k ? "#fff" : "#9ca3af",
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
          background: "#1f2937",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: "0 6px 6px 6px",
          overflow: "auto",
          fontSize: "0.8rem",
          lineHeight: 1.5,
          color: "#e5e7eb",
        }}
      >
        <code>{samples[tab].code}</code>
      </pre>

      <div style={{ marginTop: "1.5rem", textAlign: "center" }}>
        <Link
          href="/developers/api-reference"
          style={{
            color: "#a78bfa",
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
          color: "#fff",
        }}
      >
        Pricing
      </h2>
      <p style={{ textAlign: "center", color: "#9ca3af", marginBottom: "3rem" }}>
        Free tier zdarma, navždy. Vyšší tier znamená vyšší rate limit + bonus features.
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
              background: tier.primary
                ? "linear-gradient(135deg, rgba(124,58,237,0.15) 0%, rgba(124,58,237,0.05) 100%)"
                : "rgba(255,255,255,0.03)",
              border: tier.primary ? "1px solid rgba(124,58,237,0.5)" : "1px solid rgba(255,255,255,0.06)",
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
                  background: "#7c3aed",
                  color: "white",
                  padding: "0.2rem 0.7rem",
                  fontSize: "0.65rem",
                  fontWeight: 700,
                  borderRadius: 999,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}
              >
                Doporučeno
              </div>
            )}
            <div style={{ fontSize: "0.85rem", color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600 }}>
              {tier.name}
            </div>
            <div style={{ marginTop: "0.5rem", display: "flex", alignItems: "baseline", gap: 6 }}>
              <span style={{ fontSize: "1.75rem", fontWeight: 800, color: "#fff" }}>{tier.price}</span>
              <span style={{ fontSize: "0.75rem", color: "#6b7280" }}>/ {tier.period}</span>
            </div>
            <div
              style={{
                fontSize: "0.7rem",
                color: "#a78bfa",
                fontFamily: "monospace",
                marginTop: "0.4rem",
              }}
            >
              {tier.rateLimit}
            </div>
            <p style={{ fontSize: "0.8rem", color: "#9ca3af", margin: "0.75rem 0 1rem", lineHeight: 1.4 }}>
              {tier.description}
            </p>
            <ul style={{ listStyle: "none", padding: 0, margin: 0, marginBottom: "1rem" }}>
              {tier.features.map((f) => (
                <li
                  key={f}
                  style={{
                    fontSize: "0.75rem",
                    color: "#d1d5db",
                    padding: "0.3rem 0",
                    paddingLeft: "1.25rem",
                    position: "relative",
                  }}
                >
                  <span style={{ position: "absolute", left: 0, color: "#7c3aed" }}>✓</span> {f}
                </li>
              ))}
            </ul>
            <a
              href={tier.href}
              target={tier.href.startsWith("http") ? "_blank" : undefined}
              rel={tier.href.startsWith("http") ? "noopener noreferrer" : undefined}
              style={{
                display: "block",
                textAlign: "center",
                padding: "0.6rem",
                background: tier.primary ? "#7c3aed" : "rgba(255,255,255,0.05)",
                color: "white",
                borderRadius: 6,
                textDecoration: "none",
                fontSize: "0.8rem",
                fontWeight: 600,
                border: tier.primary ? "none" : "1px solid rgba(255,255,255,0.1)",
              }}
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
  const [tier, setTier] = useState("Starter");
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
    <section
      id="signup"
      style={{ padding: "4rem 1.5rem 6rem", maxWidth: 720, margin: "0 auto" }}
    >
      <h2
        style={{
          fontSize: "1.75rem",
          fontWeight: 700,
          textAlign: "center",
          marginBottom: "0.5rem",
          color: "#fff",
        }}
      >
        Požádat o API klíč
      </h2>
      <p style={{ textAlign: "center", color: "#9ca3af", marginBottom: "2rem" }}>
        Vyplň formulář, ozveme se do 24 hodin s API klíčem a pricing detaily.
        Free tier funguje bez registrace — využij ho na experimenty hned teď.
      </p>

      {submitted ? (
        <div
          style={{
            padding: "2rem",
            background: "rgba(21, 128, 61, 0.15)",
            border: "1px solid rgba(21, 128, 61, 0.4)",
            borderRadius: 12,
            textAlign: "center",
            color: "#86efac",
          }}
        >
          <div style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>✅</div>
          <div style={{ fontWeight: 600, marginBottom: "0.5rem", color: "#fff" }}>Odesláno!</div>
          <div style={{ fontSize: "0.85rem", color: "#86efac" }}>
            Ozveme se ti na <strong>{email}</strong> do 24 hodin s dalšími kroky.
          </div>
        </div>
      ) : (
        <form
          onSubmit={onSubmit}
          style={{
            padding: "2rem",
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.06)",
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
            <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Plánovaný tier
            </span>
            <select
              value={tier}
              onChange={(e) => setTier(e.target.value)}
              style={{
                padding: "0.7rem",
                background: "#0a0a0f",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 6,
                color: "#fff",
                fontSize: "0.85rem",
              }}
            >
              <option>Starter (990 Kč/měs)</option>
              <option>Pro (4 900 Kč/měs)</option>
              <option>Enterprise (od 19 900 Kč/měs)</option>
              <option>Zatím nevím</option>
            </select>
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Use case (krátce)
            </span>
            <textarea
              value={useCase}
              onChange={(e) => setUseCase(e.target.value)}
              rows={3}
              placeholder="např. broker CRM s real-time sync, mobilní aplikace pro hledání bytů, AI asistent s cenovými alerty…"
              style={{
                padding: "0.7rem",
                background: "#0a0a0f",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 6,
                color: "#fff",
                fontSize: "0.85rem",
                fontFamily: "inherit",
                resize: "vertical",
              }}
            />
          </label>

          {error && (
            <div
              style={{
                padding: "0.6rem",
                background: "rgba(185, 28, 28, 0.15)",
                border: "1px solid rgba(185, 28, 28, 0.4)",
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
              padding: "0.875rem",
              background: "linear-gradient(135deg, #7c3aed 0%, #a78bfa 100%)",
              color: "white",
              border: "none",
              borderRadius: 6,
              fontWeight: 600,
              cursor: submitting ? "wait" : "pointer",
              fontSize: "0.9rem",
              opacity: submitting || !name.trim() || !email.trim() ? 0.5 : 1,
            }}
          >
            {submitting ? "Odesílám…" : "Odeslat žádost"}
          </button>
        </form>
      )}
    </section>
  );
}

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
      <span
        style={{
          fontSize: "0.75rem",
          fontWeight: 600,
          color: "#9ca3af",
          textTransform: "uppercase",
          letterSpacing: "0.05em",
        }}
      >
        {label}
      </span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        style={{
          padding: "0.7rem",
          background: "#0a0a0f",
          border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: 6,
          color: "#fff",
          fontSize: "0.85rem",
          fontFamily: "inherit",
        }}
      />
    </label>
  );
}

function Footer() {
  return (
    <footer
      style={{
        padding: "2rem 1.5rem",
        borderTop: "1px solid rgba(255,255,255,0.05)",
        textAlign: "center",
        fontSize: "0.75rem",
        color: "#6b7280",
      }}
    >
      <div style={{ marginBottom: "0.5rem" }}>
        <Link href="/" style={{ color: "#9ca3af", textDecoration: "none", marginRight: 16 }}>
          Nemovizor
        </Link>
        <Link href="/api/openapi" style={{ color: "#9ca3af", textDecoration: "none", marginRight: 16 }}>
          OpenAPI
        </Link>
        <Link href="/llms.txt" style={{ color: "#9ca3af", textDecoration: "none", marginRight: 16 }}>
          llms.txt
        </Link>
        <Link href="/developers/api-reference" style={{ color: "#9ca3af", textDecoration: "none" }}>
          API reference
        </Link>
      </div>
      <div>© 2026 Nemovizor · Made for developers</div>
    </footer>
  );
}
