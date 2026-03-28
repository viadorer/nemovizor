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
  nl: "Nizozemsko", pl: "Polsko", si: "Slovinsko", ro: "Rumunsko", mt: "Malta",
};

const COUNTRY_FLAGS: Record<string, string> = {
  cz: "🇨🇿", sk: "🇸🇰", de: "🇩🇪", at: "🇦🇹", ch: "🇨🇭",
  fr: "🇫🇷", it: "🇮🇹", es: "🇪🇸", pt: "🇵🇹", gb: "🇬🇧",
  be: "🇧🇪", hu: "🇭🇺", hr: "🇭🇷", gr: "🇬🇷", bg: "🇧🇬",
  cy: "🇨🇾", me: "🇲🇪", al: "🇦🇱", tr: "🇹🇷", mc: "🇲🇨",
  nl: "🇳🇱", pl: "🇵🇱", si: "🇸🇮", ro: "🇷🇴", mt: "🇲🇹",
};

const CURRENCY_SYMBOLS: Record<string, string> = {
  czk: "Kč", eur: "€", chf: "CHF", gbp: "£", usd: "$",
  pln: "zł", huf: "Ft", bgn: "лв", ron: "lei", all: "Lek", try: "₺",
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
  let totalWallets = 0;
  let activeWallets = 0;
  let frozenWallets = 0;
  let totalCredits = 0;
  for (const w of wallets) {
    totalByCurrency[w.currency] = (totalByCurrency[w.currency] || 0) + w.balance_display;
    totalWallets++;
    if (w.balance > 0) activeWallets++;
    if (w.frozen) frozenWallets++;
    totalCredits += w.balance_display;
  }
  const sortedCurrencies = Object.entries(totalByCurrency).sort((a, b) => b[1] - a[1]);

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
          {/* ── Main summary card ──────────────────────────────────── */}
          <div style={{
            background: "linear-gradient(135deg, var(--bg-card) 0%, var(--bg-filter, #f8f8f8) 100%)",
            borderRadius: 16, padding: "28px 32px", border: "1px solid var(--border)",
            marginBottom: 28,
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 20 }}>
              {/* Left: total overview */}
              <div>
                <div style={{ fontSize: "0.78rem", color: "var(--text-muted)", fontWeight: 500, marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                  Celkový přehled
                </div>
                <div style={{ fontSize: "2rem", fontWeight: 800, lineHeight: 1.2, marginBottom: 8 }}>
                  {totalCredits.toLocaleString("cs", { minimumFractionDigits: 2 })} kreditů
                </div>
                <div style={{ display: "flex", gap: 20, fontSize: "0.82rem", color: "var(--text-muted)" }}>
                  <span>{totalWallets} peněženek</span>
                  <span>{activeWallets} s kreditem</span>
                  {frozenWallets > 0 && <span style={{ color: "#ef4444" }}>{frozenWallets} zmrazených</span>}
                </div>
              </div>

              {/* Right: per-currency totals */}
              <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                {sortedCurrencies.map(([cur, total]) => {
                  const walletCount = wallets.filter(w => w.currency === cur).length;
                  return (
                    <div key={cur} style={{
                      background: "var(--bg-card)", borderRadius: 12, padding: "14px 20px",
                      border: "1px solid var(--border)", minWidth: 140, textAlign: "center",
                    }}>
                      <div style={{ fontSize: "1.2rem", fontWeight: 700 }}>
                        {formatBalance(total, cur)}
                      </div>
                      <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: 2 }}>
                        {walletCount} {walletCount === 1 ? "země" : walletCount < 5 ? "země" : "zemí"}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Per-country wallets — sorted by balance desc */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 16 }}>
            {[...wallets].sort((a, b) => b.balance - a.balance).map((w) => (
              <Link
                key={w.id}
                href={`/dashboard/penezenka/${w.country}`}
                style={{
                  display: "block", padding: "20px 24px", borderRadius: 12,
                  background: w.frozen ? "var(--bg-filter)" : "var(--bg-card)",
                  border: `1px solid ${w.balance_display <= 0 ? "#ef4444" : "var(--border)"}`,
                  textDecoration: "none", color: "inherit", transition: "border-color 0.15s, box-shadow 0.15s",
                  opacity: w.frozen ? 0.6 : 1,
                  position: "relative", overflow: "hidden",
                }}
              >
                {/* Balance indicator bar at top */}
                <div style={{
                  position: "absolute", top: 0, left: 0, right: 0, height: 3,
                  background: w.balance_display > 1000 ? "#22c55e" : w.balance_display > 0 ? "#f59e0b" : "#ef4444",
                }} />

                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontSize: "1.8rem" }}>{COUNTRY_FLAGS[w.country] || w.country.toUpperCase()}</span>
                    <div>
                      <div style={{ fontWeight: 600 }}>{COUNTRY_NAMES[w.country] || w.country.toUpperCase()}</div>
                      <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>{w.currency.toUpperCase()}</div>
                    </div>
                  </div>
                  {w.frozen && (
                    <span style={{ fontSize: "0.7rem", background: "#ef4444", color: "#fff", borderRadius: 6, padding: "2px 8px", fontWeight: 600 }}>
                      Zmrazená
                    </span>
                  )}
                  {!w.frozen && w.balance_display <= 0 && (
                    <span style={{ fontSize: "0.7rem", background: "#fef2f2", color: "#ef4444", borderRadius: 6, padding: "2px 8px", fontWeight: 600 }}>
                      Prázdná
                    </span>
                  )}
                </div>

                <div style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: 4 }}>
                  {formatBalance(w.balance_display, w.currency)}
                </div>

                {w.credit_limit > 0 && (
                  <div style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>
                    Kreditní limit: {formatBalance(w.credit_limit_display, w.currency)}
                  </div>
                )}

                <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: 6, display: "flex", justifyContent: "space-between" }}>
                  <span>Detail →</span>
                </div>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
