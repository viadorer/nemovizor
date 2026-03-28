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

type Transaction = {
  id: string; wallet_id: string; type: string; amount_display: number;
  balance_before_display: number; balance_after_display: number;
  category: string; description: string | null;
  reference_type: string | null; created_at: string;
  country: string; currency: string;
};

type DaySummary = {
  date: string;
  byCurrency: Record<string, { credit: number; debit: number; net: number }>;
  byCountry: Record<string, { credit: number; debit: number; currency: string; flag: string }>;
  count: number;
  transactions: Transaction[];
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

const TYPE_LABELS: Record<string, string> = { credit: "Příjem", debit: "Výdaj", hold: "Blokace", release: "Uvolnění", refund: "Vrácení" };
const TYPE_COLORS: Record<string, string> = { credit: "#22c55e", debit: "#ef4444", hold: "#f59e0b", release: "#3b82f6", refund: "#8b5cf6" };
const CATEGORY_LABELS: Record<string, string> = {
  deposit: "Dobití", tip_purchase: "TIP", listing_fee: "Inzerce", daily_billing: "Denní inzerce",
  broker_promo: "Promo makléře", project_page: "Stránka projektu", refund: "Vrácení",
  bonus: "Bonus", admin_adjustment: "Úprava admin", agency_promo: "Promo kanceláře",
};
const CATEGORY_ICONS: Record<string, string> = {
  deposit: "💰", tip_purchase: "⭐", listing_fee: "📋", daily_billing: "📅",
  broker_promo: "👤", project_page: "🏗️", refund: "↩️", bonus: "🎁",
  admin_adjustment: "⚙️", agency_promo: "🏢",
};

function fmt(n: number, cur: string) {
  return `${n.toLocaleString("cs", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${CURRENCY_SYMBOLS[cur] || cur.toUpperCase()}`;
}

function formatDateLabel(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400_000).toISOString().slice(0, 10);
  if (dateStr === today) return "Dnes";
  if (dateStr === yesterday) return "Včera";
  return d.toLocaleDateString("cs-CZ", { weekday: "short", day: "numeric", month: "long", year: "numeric" });
}

export default function WalletOverviewPage() {
  const { user } = useAuth();
  const t = useT();
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [allTx, setAllTx] = useState<Transaction[]>([]);
  const [txTotal, setTxTotal] = useState(0);
  const [txPage, setTxPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [txLoading, setTxLoading] = useState(false);
  const [expandedDays, setExpandedDays] = useState<Set<string>>(new Set());
  const [expandedCountries, setExpandedCountries] = useState<Set<string>>(new Set());
  const TX_LIMIT = 300;

  useEffect(() => {
    if (!user) return;
    fetch("/api/wallet")
      .then((r) => r.json())
      .then((d) => setWallets(d.wallets || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user]);

  // Load all transactions
  useEffect(() => {
    if (!user || wallets.length === 0) return;
    setTxLoading(true);
    fetch(`/api/wallet/transactions?all=true&page=${txPage}&limit=${TX_LIMIT}`)
      .then((r) => r.json())
      .then((d) => { setAllTx(d.transactions || []); setTxTotal(d.total || 0); })
      .catch(() => {})
      .finally(() => setTxLoading(false));
  }, [user, wallets, txPage]);

  // Aggregate
  const totalByCurrency: Record<string, number> = {};
  let totalWallets = 0, activeWallets = 0, frozenWallets = 0, totalCredits = 0;
  for (const w of wallets) {
    totalByCurrency[w.currency] = (totalByCurrency[w.currency] || 0) + w.balance_display;
    totalWallets++;
    if (w.balance > 0) activeWallets++;
    if (w.frozen) frozenWallets++;
    totalCredits += w.balance_display;
  }
  const sortedCurrencies = Object.entries(totalByCurrency).sort((a, b) => b[1] - a[1]);

  // Group transactions by day
  const daySummaries: DaySummary[] = [];
  const dayMap = new Map<string, Transaction[]>();
  for (const tx of allTx) {
    const date = tx.created_at.slice(0, 10);
    if (!dayMap.has(date)) dayMap.set(date, []);
    dayMap.get(date)!.push(tx);
  }
  for (const [date, txs] of dayMap) {
    const byCurrency: Record<string, { credit: number; debit: number; net: number }> = {};
    const byCountry: Record<string, { credit: number; debit: number; currency: string; flag: string }> = {};
    for (const tx of txs) {
      const cur = tx.currency || "czk";
      const ctry = tx.country || "??";
      if (!byCurrency[cur]) byCurrency[cur] = { credit: 0, debit: 0, net: 0 };
      if (!byCountry[ctry]) byCountry[ctry] = { credit: 0, debit: 0, currency: cur, flag: COUNTRY_FLAGS[ctry] || ctry.toUpperCase() };
      const isCredit = tx.type === "credit" || tx.type === "refund" || tx.type === "release";
      if (isCredit) {
        byCurrency[cur].credit += tx.amount_display;
        byCountry[ctry].credit += tx.amount_display;
      } else {
        byCurrency[cur].debit += tx.amount_display;
        byCountry[ctry].debit += tx.amount_display;
      }
      byCurrency[cur].net = byCurrency[cur].credit - byCurrency[cur].debit;
    }
    daySummaries.push({ date, byCurrency, byCountry, count: txs.length, transactions: txs });
  }

  const toggleDay = (date: string) => {
    setExpandedDays((prev) => { const n = new Set(prev); if (n.has(date)) n.delete(date); else n.add(date); return n; });
  };
  const toggleCountry = (key: string) => {
    setExpandedCountries((prev) => { const n = new Set(prev); if (n.has(key)) n.delete(key); else n.add(key); return n; });
  };

  const txPages = Math.ceil(txTotal / TX_LIMIT);

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
          <p>Zatím nemáte žádnou peněženku.</p>
        </div>
      ) : (
        <>
          {/* ── Main summary card ──────────────────────────────────── */}
          <div style={{
            background: "linear-gradient(135deg, var(--bg-card) 0%, var(--bg-filter, #f8f8f8) 100%)",
            borderRadius: 16, padding: "28px 32px", border: "1px solid var(--border)", marginBottom: 28,
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 20 }}>
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
              <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                {sortedCurrencies.map(([cur, total]) => {
                  const walletCount = wallets.filter(w => w.currency === cur).length;
                  return (
                    <div key={cur} style={{ background: "var(--bg-card)", borderRadius: 12, padding: "14px 20px", border: "1px solid var(--border)", minWidth: 140, textAlign: "center" }}>
                      <div style={{ fontSize: "1.2rem", fontWeight: 700 }}>{fmt(total, cur)}</div>
                      <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: 2 }}>
                        {walletCount} {walletCount === 1 ? "země" : walletCount < 5 ? "země" : "zemí"}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* ── Per-country wallets ────────────────────────────────── */}
          <h2 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: 12 }}>Peněženky podle zemí</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 16, marginBottom: 32 }}>
            {[...wallets].sort((a, b) => b.balance - a.balance).map((w) => (
              <Link key={w.id} href={`/dashboard/penezenka/${w.country}`}
                style={{
                  display: "block", padding: "20px 24px", borderRadius: 12,
                  background: w.frozen ? "var(--bg-filter)" : "var(--bg-card)",
                  border: `1px solid ${w.balance_display <= 0 ? "#ef4444" : "var(--border)"}`,
                  textDecoration: "none", color: "inherit", transition: "border-color 0.15s",
                  opacity: w.frozen ? 0.6 : 1, position: "relative", overflow: "hidden",
                }}>
                <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: w.balance_display > 1000 ? "#22c55e" : w.balance_display > 0 ? "#f59e0b" : "#ef4444" }} />
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontSize: "1.8rem" }}>{COUNTRY_FLAGS[w.country] || w.country.toUpperCase()}</span>
                    <div>
                      <div style={{ fontWeight: 600 }}>{COUNTRY_NAMES[w.country] || w.country.toUpperCase()}</div>
                      <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>{w.currency.toUpperCase()}</div>
                    </div>
                  </div>
                  {w.frozen && <span style={{ fontSize: "0.7rem", background: "#ef4444", color: "#fff", borderRadius: 6, padding: "2px 8px", fontWeight: 600 }}>Zmrazená</span>}
                  {!w.frozen && w.balance_display <= 0 && <span style={{ fontSize: "0.7rem", background: "#fef2f2", color: "#ef4444", borderRadius: 6, padding: "2px 8px", fontWeight: 600 }}>Prázdná</span>}
                </div>
                <div style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: 4 }}>{fmt(w.balance_display, w.currency)}</div>
                {w.credit_limit > 0 && <div style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>Limit: {fmt(w.credit_limit_display, w.currency)}</div>}
                <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: 6 }}>Detail →</div>
              </Link>
            ))}
          </div>

          {/* ── Daily transaction summary (all wallets) ────────────── */}
          <h2 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: 12 }}>Souhrnný přehled transakcí</h2>

          {txLoading ? (
            <p style={{ color: "var(--text-muted)" }}>{t.common.loading}</p>
          ) : daySummaries.length === 0 ? (
            <p style={{ color: "var(--text-muted)" }}>Zatím žádné transakce.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {daySummaries.map((day) => {
                const isExpanded = expandedDays.has(day.date);
                const currencies = Object.entries(day.byCurrency);
                const countries = Object.entries(day.byCountry).sort((a, b) => (b[1].credit + b[1].debit) - (a[1].credit + a[1].debit));

                return (
                  <div key={day.date} style={{ background: "var(--bg-card)", borderRadius: 12, border: "1px solid var(--border)", overflow: "hidden" }}>
                    {/* Day header */}
                    <button onClick={() => toggleDay(day.date)}
                      style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 20px", border: "none", background: "transparent", cursor: "pointer", textAlign: "left", gap: 16 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 12, flex: 1 }}>
                        <span style={{ fontSize: "1.1rem", transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)", transition: "transform 0.15s" }}>▶</span>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: "0.9rem" }}>{formatDateLabel(day.date)}</div>
                          <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                            {day.count} {day.count === 1 ? "transakce" : day.count < 5 ? "transakce" : "transakcí"}
                            {" · "}{countries.length} {countries.length === 1 ? "země" : countries.length < 5 ? "země" : "zemí"}
                          </div>
                        </div>
                      </div>

                      {/* Per-currency daily totals */}
                      <div style={{ display: "flex", gap: 16, alignItems: "center", flexShrink: 0, flexWrap: "wrap" }}>
                        {currencies.map(([cur, sums]) => (
                          <div key={cur} style={{ textAlign: "right", minWidth: 100 }}>
                            <div style={{ fontSize: "0.68rem", color: "var(--text-muted)", textTransform: "uppercase" }}>{cur}</div>
                            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                              {sums.credit > 0 && <span style={{ fontWeight: 700, color: "#22c55e", fontSize: "0.82rem" }}>+{fmt(sums.credit, cur)}</span>}
                              {sums.debit > 0 && <span style={{ fontWeight: 700, color: "#ef4444", fontSize: "0.82rem" }}>-{fmt(sums.debit, cur)}</span>}
                            </div>
                          </div>
                        ))}
                      </div>
                    </button>

                    {/* Expanded: breakdown by country, then transactions per country */}
                    {isExpanded && (
                      <div style={{ borderTop: "1px solid var(--border)", padding: "8px 12px 12px" }}>
                        {countries.map(([ctry, sums]) => {
                          const countryKey = `${day.date}-${ctry}`;
                          const isCtryExpanded = expandedCountries.has(countryKey);
                          const ctryTxs = day.transactions.filter(tx => tx.country === ctry);

                          return (
                            <div key={ctry} style={{ marginBottom: 4 }}>
                              {/* Country row */}
                              <button onClick={() => toggleCountry(countryKey)}
                                style={{
                                  width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
                                  padding: "10px 12px", border: "none", borderRadius: 8, background: isCtryExpanded ? "var(--bg-filter, #f5f5f5)" : "transparent",
                                  cursor: "pointer", textAlign: "left", gap: 12, transition: "background 0.1s",
                                }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                  <span style={{ fontSize: "0.85rem", transform: isCtryExpanded ? "rotate(90deg)" : "rotate(0deg)", transition: "transform 0.15s", opacity: 0.5 }}>▶</span>
                                  <span style={{ fontSize: "1.2rem" }}>{sums.flag}</span>
                                  <span style={{ fontWeight: 600, fontSize: "0.85rem" }}>{COUNTRY_NAMES[ctry] || ctry.toUpperCase()}</span>
                                  <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{ctryTxs.length}×</span>
                                </div>
                                <div style={{ display: "flex", gap: 12 }}>
                                  {sums.credit > 0 && <span style={{ fontWeight: 600, color: "#22c55e", fontSize: "0.82rem" }}>+{fmt(sums.credit, sums.currency)}</span>}
                                  {sums.debit > 0 && <span style={{ fontWeight: 600, color: "#ef4444", fontSize: "0.82rem" }}>-{fmt(sums.debit, sums.currency)}</span>}
                                </div>
                              </button>

                              {/* Country transactions detail */}
                              {isCtryExpanded && (
                                <div style={{ marginLeft: 36, marginTop: 4, marginBottom: 8 }}>
                                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                                    <thead>
                                      <tr>
                                        <th style={{ textAlign: "left", padding: "4px 8px", fontSize: "0.7rem", color: "var(--text-muted)" }}>Čas</th>
                                        <th style={{ textAlign: "left", padding: "4px 8px", fontSize: "0.7rem", color: "var(--text-muted)" }}>Typ</th>
                                        <th style={{ textAlign: "left", padding: "4px 8px", fontSize: "0.7rem", color: "var(--text-muted)" }}>Kategorie</th>
                                        <th style={{ textAlign: "left", padding: "4px 8px", fontSize: "0.7rem", color: "var(--text-muted)" }}>Popis</th>
                                        <th style={{ textAlign: "right", padding: "4px 8px", fontSize: "0.7rem", color: "var(--text-muted)" }}>Částka</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {ctryTxs.map((tx) => {
                                        const isCredit = tx.type === "credit" || tx.type === "refund" || tx.type === "release";
                                        return (
                                          <tr key={tx.id} style={{ borderTop: "1px solid var(--border)" }}>
                                            <td style={{ padding: "6px 8px", fontSize: "0.78rem", color: "var(--text-muted)", whiteSpace: "nowrap" }}>
                                              {new Date(tx.created_at).toLocaleTimeString("cs-CZ", { hour: "2-digit", minute: "2-digit" })}
                                            </td>
                                            <td style={{ padding: "6px 8px" }}>
                                              <span style={{ fontSize: "0.75rem", fontWeight: 600, color: TYPE_COLORS[tx.type] || "var(--text)" }}>
                                                {TYPE_LABELS[tx.type] || tx.type}
                                              </span>
                                            </td>
                                            <td style={{ padding: "6px 8px", fontSize: "0.78rem" }}>
                                              {CATEGORY_ICONS[tx.category] || "📌"} {CATEGORY_LABELS[tx.category] || tx.category}
                                            </td>
                                            <td style={{ padding: "6px 8px", fontSize: "0.78rem", color: "var(--text-muted)", maxWidth: 250, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={tx.description || ""}>
                                              {tx.description || "—"}
                                            </td>
                                            <td style={{ padding: "6px 8px", textAlign: "right", fontWeight: 600, fontSize: "0.82rem", color: isCredit ? "#22c55e" : "#ef4444" }}>
                                              {isCredit ? "+" : "-"}{fmt(tx.amount_display, tx.currency)}
                                            </td>
                                          </tr>
                                        );
                                      })}
                                    </tbody>
                                  </table>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Pagination for transactions */}
          {txPages > 1 && (
            <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 16, alignItems: "center" }}>
              <button disabled={txPage <= 1} onClick={() => setTxPage(txPage - 1)}
                style={{ padding: "6px 14px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-card)", cursor: txPage > 1 ? "pointer" : "default", opacity: txPage <= 1 ? 0.4 : 1 }}>← Novější</button>
              <span style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>{txPage} / {txPages}</span>
              <button disabled={txPage >= txPages} onClick={() => setTxPage(txPage + 1)}
                style={{ padding: "6px 14px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-card)", cursor: txPage < txPages ? "pointer" : "default", opacity: txPage >= txPages ? 0.4 : 1 }}>Starší →</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
