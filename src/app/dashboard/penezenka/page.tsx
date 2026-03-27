"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/auth-provider";
import { useT } from "@/i18n/provider";

type Wallet = {
  id: string; country: string; currency: string;
  balance: number; balance_display: number;
  credit_limit: number; credit_limit_display: number;
  frozen: boolean; created_at: string;
};

const COUNTRY_NAMES: Record<string, string> = {
  cz: "Česko", sk: "Slovensko", de: "Německo", at: "Rakousko", ch: "Švýcarsko",
  fr: "Francie", it: "Itálie", es: "Španělsko", pt: "Portugalsko", gb: "Velká Británie",
  be: "Belgie", hu: "Maďarsko", hr: "Chorvatsko", gr: "Řecko", bg: "Bulharsko",
  cy: "Kypr", me: "Černá Hora", al: "Albánie", tr: "Turecko", mc: "Monako",
};

const COUNTRY_FLAGS: Record<string, string> = {
  cz: "🇨🇿", sk: "🇸🇰", de: "🇩🇪", at: "🇦🇹", ch: "🇨🇭",
  fr: "🇫🇷", it: "🇮🇹", es: "🇪🇸", pt: "🇵🇹", gb: "🇬🇧",
  be: "🇧🇪", hu: "🇭🇺", hr: "🇭🇷", gr: "🇬🇷", bg: "🇧🇬",
  cy: "🇨🇾", me: "🇲🇪", al: "🇦🇱", tr: "🇹🇷", mc: "🇲🇨",
};

const CURRENCY_SYMBOLS: Record<string, string> = {
  czk: "Kč", eur: "€", chf: "CHF", gbp: "£", usd: "$",
};

function formatBalance(amount: number, currency: string): string {
  const sym = CURRENCY_SYMBOLS[currency] || currency.toUpperCase();
  return `${amount.toLocaleString("cs", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${sym}`;
}

export default function WalletOverviewPage() {
  const { user } = useAuth();
  const t = useT();
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    fetch("/api/wallet")
      .then((r) => r.json())
      .then((d) => setWallets(d.wallets || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user]);

  const totalByCurrency: Record<string, number> = {};
  for (const w of wallets) {
    totalByCurrency[w.currency] = (totalByCurrency[w.currency] || 0) + w.balance_display;
  }

  return (
    <div className="dashboard-page">
      <h1 className="dashboard-page-title">Peněženka</h1>

      {loading ? (
        <p style={{ color: "var(--text-muted)" }}>{t.common.loading}</p>
      ) : wallets.length === 0 ? (
        <div className="dashboard-empty">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
            <line x1="1" y1="10" x2="23" y2="10" />
          </svg>
          <p>Zatím nemáte žádnou peněženku. Peněženka se vytvoří automaticky při prvním nákupu služby.</p>
        </div>
      ) : (
        <>
          {/* Total summary */}
          {Object.keys(totalByCurrency).length > 0 && (
            <div className="admin-stats" style={{ marginBottom: 24 }}>
              {Object.entries(totalByCurrency).map(([cur, total]) => (
                <div key={cur} className="admin-stat-card">
                  <div className="label">Celkem {cur.toUpperCase()}</div>
                  <div className="value">{formatBalance(total, cur)}</div>
                </div>
              ))}
            </div>
          )}

          {/* Per-country wallets */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 16 }}>
            {wallets.map((w) => (
              <Link
                key={w.id}
                href={`/dashboard/penezenka/${w.country}`}
                style={{
                  display: "block", padding: "20px 24px", borderRadius: 12,
                  background: "var(--bg-card)", border: "1px solid var(--border)",
                  textDecoration: "none", color: "inherit", transition: "border-color 0.15s",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                  <span style={{ fontSize: "1.8rem" }}>{COUNTRY_FLAGS[w.country] || w.country.toUpperCase()}</span>
                  <div>
                    <div style={{ fontWeight: 600 }}>{COUNTRY_NAMES[w.country] || w.country.toUpperCase()}</div>
                    <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{w.currency.toUpperCase()}</div>
                  </div>
                </div>
                <div style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: 4 }}>
                  {formatBalance(w.balance_display, w.currency)}
                </div>
                {w.credit_limit > 0 && (
                  <div style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>
                    Kreditní limit: {formatBalance(w.credit_limit_display, w.currency)}
                  </div>
                )}
                {w.frozen && (
                  <div style={{ fontSize: "0.78rem", color: "#ef4444", fontWeight: 600, marginTop: 4 }}>
                    Zmrazená
                  </div>
                )}
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
