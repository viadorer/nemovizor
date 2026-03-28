"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/components/auth-provider";
import { useT } from "@/i18n/provider";

type Wallet = {
  id: string; country: string; currency: string;
  balance: number; balance_display: number;
  credit_limit_display: number; frozen: boolean;
};

type Transaction = {
  id: string; type: string; amount_display: number;
  balance_before_display: number; balance_after_display: number;
  category: string; description: string | null;
  reference_type: string | null; created_at: string;
};

type DaySummary = {
  date: string;
  totalCredit: number;
  totalDebit: number;
  net: number;
  balanceEnd: number;
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
  deposit: "Dobití", tip_purchase: "TIP", listing_fee: "Inzerce", broker_promo: "Promo makléře",
  project_page: "Stránka projektu", refund: "Vrácení", bonus: "Bonus", admin_adjustment: "Úprava admin",
  agency_promo: "Promo kanceláře", daily_billing: "Denní inzerce",
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
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (dateStr === today.toISOString().slice(0, 10)) return "Dnes";
  if (dateStr === yesterday.toISOString().slice(0, 10)) return "Včera";

  return d.toLocaleDateString("cs-CZ", { weekday: "short", day: "numeric", month: "long", year: "numeric" });
}

const TOPUP_PRESETS: Record<string, number[]> = {
  czk: [500, 1000, 2000, 5000, 10000],
  eur: [20, 50, 100, 200, 500],
  chf: [20, 50, 100, 200, 500],
  gbp: [20, 50, 100, 200, 500],
  pln: [50, 100, 200, 500, 1000],
  huf: [5000, 10000, 20000, 50000, 100000],
};

export default function WalletDetailPage() {
  const { country } = useParams() as { country: string };
  const { user } = useAuth();
  const t = useT();
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [showTopup, setShowTopup] = useState(false);
  const [topupAmount, setTopupAmount] = useState(0);
  const [topupLoading, setTopupLoading] = useState(false);
  const [topupMsg, setTopupMsg] = useState("");
  const [expandedDays, setExpandedDays] = useState<Set<string>>(new Set());
  const PAGE_SIZE = 200; // fetch more to group by day

  useEffect(() => {
    if (!user) return;
    fetch("/api/wallet")
      .then((r) => r.json())
      .then((d) => {
        const w = (d.wallets || []).find((w: Wallet) => w.country === country);
        setWallet(w || null);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user, country]);

  const loadTransactions = useCallback(async () => {
    if (!wallet) return;
    const res = await fetch(`/api/wallet/transactions?wallet_id=${wallet.id}&page=${page}&limit=${PAGE_SIZE}`);
    const data = await res.json();
    setTransactions(data.transactions || []);
    setTotal(data.total || 0);
  }, [wallet, page]);

  useEffect(() => { loadTransactions(); }, [loadTransactions]);

  // Group transactions by day
  const daySummaries: DaySummary[] = [];
  const dayMap = new Map<string, Transaction[]>();

  for (const tx of transactions) {
    const date = tx.created_at.slice(0, 10);
    if (!dayMap.has(date)) dayMap.set(date, []);
    dayMap.get(date)!.push(tx);
  }

  for (const [date, txs] of dayMap) {
    let totalCredit = 0;
    let totalDebit = 0;
    for (const tx of txs) {
      if (tx.type === "credit" || tx.type === "refund" || tx.type === "release") {
        totalCredit += tx.amount_display;
      } else {
        totalDebit += tx.amount_display;
      }
    }
    // Balance at end of day = last transaction's balance_after
    const balanceEnd = txs[0].balance_after_display; // txs are sorted desc
    daySummaries.push({
      date,
      totalCredit,
      totalDebit,
      net: totalCredit - totalDebit,
      balanceEnd,
      count: txs.length,
      transactions: txs,
    });
  }

  const toggleDay = (date: string) => {
    setExpandedDays((prev) => {
      const next = new Set(prev);
      if (next.has(date)) next.delete(date);
      else next.add(date);
      return next;
    });
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);
  const cur = wallet?.currency || "czk";

  if (loading) return <div className="dashboard-page"><p style={{ color: "var(--text-muted)" }}>{t.common.loading}</p></div>;
  if (!wallet) return <div className="dashboard-page"><p style={{ color: "var(--text-muted)" }}>Peněženka pro {country.toUpperCase()} neexistuje.</p><Link href="/dashboard/penezenka" style={{ color: "var(--color-accent)" }}>Zpět</Link></div>;

  return (
    <div className="dashboard-page">
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
        <Link href="/dashboard/penezenka" style={{ color: "var(--text-muted)", textDecoration: "none", fontSize: "0.85rem" }}>&larr; Peněženky</Link>
        <h1 className="dashboard-page-title" style={{ marginBottom: 0 }}>
          {COUNTRY_FLAGS[country] || ""} {COUNTRY_NAMES[country] || country.toUpperCase()}
        </h1>
      </div>

      {/* ── Balance card ──────────────────────────────────────── */}
      <div className="admin-stats" style={{ marginBottom: 24 }}>
        <div className="admin-stat-card">
          <div className="label">Zůstatek</div>
          <div className="value" style={{ color: wallet.balance >= 0 ? "var(--text)" : "#ef4444" }}>
            {fmt(wallet.balance_display, cur)}
          </div>
        </div>
        {wallet.credit_limit_display > 0 && (
          <div className="admin-stat-card">
            <div className="label">Kreditní limit</div>
            <div className="value">{fmt(wallet.credit_limit_display, cur)}</div>
          </div>
        )}
        <div className="admin-stat-card">
          <div className="label">Transakcí celkem</div>
          <div className="value">{total}</div>
        </div>
        <div className="admin-stat-card">
          <div className="label">Dnů s aktivitou</div>
          <div className="value">{daySummaries.length}</div>
        </div>
        {wallet.frozen && (
          <div className="admin-stat-card" style={{ borderColor: "#ef4444" }}>
            <div className="label" style={{ color: "#ef4444" }}>Stav</div>
            <div className="value" style={{ color: "#ef4444" }}>Zmrazená</div>
          </div>
        )}
      </div>

      {/* ── Top-up button ─────────────────────────────────────── */}
      {!wallet.frozen && (
        <div style={{ marginBottom: 24 }}>
          {!showTopup ? (
            <button
              onClick={() => { setShowTopup(true); setTopupAmount(TOPUP_PRESETS[cur]?.[2] || 100); setTopupMsg(""); }}
              style={{ padding: "10px 24px", borderRadius: 10, border: "none", background: "var(--color-accent, #ffb800)", color: "#000", fontWeight: 700, fontSize: "0.9rem", cursor: "pointer" }}
            >
              Dobít peněženku
            </button>
          ) : (
            <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12, padding: 20, maxWidth: 480 }}>
              <div style={{ fontWeight: 600, marginBottom: 12 }}>Dobít peněženku</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
                {(TOPUP_PRESETS[cur] || [100, 500, 1000]).map((amt) => (
                  <button
                    key={amt}
                    onClick={() => setTopupAmount(amt)}
                    style={{
                      padding: "8px 16px", borderRadius: 8, border: "1px solid var(--border)",
                      background: topupAmount === amt ? "var(--color-accent, #ffb800)" : "var(--bg-card)",
                      color: topupAmount === amt ? "#000" : "inherit", fontWeight: 600, fontSize: "0.85rem", cursor: "pointer",
                    }}
                  >
                    {amt.toLocaleString("cs")} {CURRENCY_SYMBOLS[cur] || cur.toUpperCase()}
                  </button>
                ))}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                <span style={{ fontSize: "0.85rem" }}>Vlastní:</span>
                <input type="number" min={1} value={topupAmount} onChange={(e) => setTopupAmount(Number(e.target.value))}
                  style={{ width: 120, padding: "6px 12px", borderRadius: 8, border: "1px solid var(--border)", fontSize: "0.9rem" }} />
                <span style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>{CURRENCY_SYMBOLS[cur] || cur.toUpperCase()}</span>
              </div>
              {topupMsg && <div style={{ fontSize: "0.82rem", color: topupMsg.includes("Chyba") ? "#ef4444" : "#22c55e", marginBottom: 8 }}>{topupMsg}</div>}
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  disabled={topupLoading || topupAmount <= 0}
                  onClick={async () => {
                    setTopupLoading(true); setTopupMsg("");
                    try {
                      const res = await fetch("/api/wallet/topup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ wallet_id: wallet.id, amount: topupAmount }) });
                      const data = await res.json();
                      if (data.ok) {
                        setTopupMsg(`Dobito ${topupAmount.toLocaleString("cs")} ${CURRENCY_SYMBOLS[cur]}`);
                        setWallet({ ...wallet, balance_display: data.new_balance, balance: data.new_balance * 100 });
                        setShowTopup(false); loadTransactions();
                      } else setTopupMsg(`Chyba: ${data.error}`);
                    } catch { setTopupMsg("Chyba při dobíjení"); }
                    setTopupLoading(false);
                  }}
                  style={{ padding: "8px 20px", borderRadius: 8, border: "none", background: "#22c55e", color: "#fff", fontWeight: 600, cursor: topupLoading ? "wait" : "pointer", opacity: topupLoading ? 0.6 : 1 }}
                >
                  {topupLoading ? "Dobíjím..." : `Dobít ${topupAmount.toLocaleString("cs")} ${CURRENCY_SYMBOLS[cur] || ""}`}
                </button>
                <button onClick={() => { setShowTopup(false); setTopupMsg(""); }}
                  style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-card)", cursor: "pointer" }}>
                  Zrušit
                </button>
              </div>
            </div>
          )}
          {topupMsg && !showTopup && <div style={{ fontSize: "0.82rem", color: "#22c55e", marginTop: 8 }}>{topupMsg}</div>}
        </div>
      )}

      {/* ── Daily summaries ───────────────────────────────────── */}
      <h2 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: 12 }}>Historie transakcí</h2>

      {daySummaries.length === 0 ? (
        <p style={{ color: "var(--text-muted)" }}>Zatím žádné transakce.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {daySummaries.map((day) => {
            const isExpanded = expandedDays.has(day.date);
            return (
              <div key={day.date} style={{ background: "var(--bg-card)", borderRadius: 12, border: "1px solid var(--border)", overflow: "hidden" }}>
                {/* Day header — clickable */}
                <button
                  onClick={() => toggleDay(day.date)}
                  style={{
                    width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "14px 20px", border: "none", background: "transparent", cursor: "pointer",
                    textAlign: "left", gap: 16,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 12, flex: 1 }}>
                    <span style={{ fontSize: "1.1rem", transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)", transition: "transform 0.15s" }}>▶</span>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: "0.9rem" }}>{formatDateLabel(day.date)}</div>
                      <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                        {day.count} {day.count === 1 ? "transakce" : day.count < 5 ? "transakce" : "transakcí"}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 20, alignItems: "center", flexShrink: 0 }}>
                    {day.totalCredit > 0 && (
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>Příjmy</div>
                        <div style={{ fontWeight: 700, color: "#22c55e", fontSize: "0.88rem" }}>+{fmt(day.totalCredit, cur)}</div>
                      </div>
                    )}
                    {day.totalDebit > 0 && (
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>Výdaje</div>
                        <div style={{ fontWeight: 700, color: "#ef4444", fontSize: "0.88rem" }}>-{fmt(day.totalDebit, cur)}</div>
                      </div>
                    )}
                    <div style={{ textAlign: "right", minWidth: 100 }}>
                      <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>Zůstatek</div>
                      <div style={{ fontWeight: 700, fontSize: "0.88rem" }}>{fmt(day.balanceEnd, cur)}</div>
                    </div>
                  </div>
                </button>

                {/* Expanded: individual transactions */}
                {isExpanded && (
                  <div style={{ borderTop: "1px solid var(--border)", padding: "0 8px 8px" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse" }}>
                      <thead>
                        <tr>
                          <th style={{ textAlign: "left", padding: "8px 12px", fontSize: "0.72rem", color: "var(--text-muted)", fontWeight: 500 }}>Čas</th>
                          <th style={{ textAlign: "left", padding: "8px 12px", fontSize: "0.72rem", color: "var(--text-muted)", fontWeight: 500 }}>Typ</th>
                          <th style={{ textAlign: "left", padding: "8px 12px", fontSize: "0.72rem", color: "var(--text-muted)", fontWeight: 500 }}>Kategorie</th>
                          <th style={{ textAlign: "left", padding: "8px 12px", fontSize: "0.72rem", color: "var(--text-muted)", fontWeight: 500 }}>Popis</th>
                          <th style={{ textAlign: "right", padding: "8px 12px", fontSize: "0.72rem", color: "var(--text-muted)", fontWeight: 500 }}>Částka</th>
                          <th style={{ textAlign: "right", padding: "8px 12px", fontSize: "0.72rem", color: "var(--text-muted)", fontWeight: 500 }}>Zůstatek</th>
                        </tr>
                      </thead>
                      <tbody>
                        {day.transactions.map((tx) => (
                          <tr key={tx.id} style={{ borderTop: "1px solid var(--border)" }}>
                            <td style={{ padding: "8px 12px", fontSize: "0.8rem", whiteSpace: "nowrap", color: "var(--text-muted)" }}>
                              {new Date(tx.created_at).toLocaleTimeString("cs-CZ", { hour: "2-digit", minute: "2-digit" })}
                            </td>
                            <td style={{ padding: "8px 12px" }}>
                              <span style={{ fontSize: "0.78rem", fontWeight: 600, color: TYPE_COLORS[tx.type] || "var(--text)" }}>
                                {TYPE_LABELS[tx.type] || tx.type}
                              </span>
                            </td>
                            <td style={{ padding: "8px 12px", fontSize: "0.8rem" }}>
                              <span style={{ marginRight: 4 }}>{CATEGORY_ICONS[tx.category] || "📌"}</span>
                              {CATEGORY_LABELS[tx.category] || tx.category}
                            </td>
                            <td style={{ padding: "8px 12px", fontSize: "0.8rem", color: "var(--text-muted)", maxWidth: 280, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={tx.description || ""}>
                              {tx.description || "—"}
                            </td>
                            <td style={{ padding: "8px 12px", textAlign: "right", fontWeight: 600, fontSize: "0.85rem", color: tx.type === "credit" || tx.type === "refund" || tx.type === "release" ? "#22c55e" : "#ef4444" }}>
                              {tx.type === "credit" || tx.type === "refund" || tx.type === "release" ? "+" : "-"}{fmt(tx.amount_display, cur)}
                            </td>
                            <td style={{ padding: "8px 12px", textAlign: "right", fontSize: "0.8rem", color: "var(--text-muted)" }}>
                              {fmt(tx.balance_after_display, cur)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 16, alignItems: "center" }}>
          <button disabled={page <= 1} onClick={() => setPage(page - 1)} style={{ padding: "6px 14px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-card)", cursor: page > 1 ? "pointer" : "default", opacity: page <= 1 ? 0.4 : 1 }}>← Novější</button>
          <span style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>{page} / {totalPages}</span>
          <button disabled={page >= totalPages} onClick={() => setPage(page + 1)} style={{ padding: "6px 14px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-card)", cursor: page < totalPages ? "pointer" : "default", opacity: page >= totalPages ? 0.4 : 1 }}>Starší →</button>
        </div>
      )}
    </div>
  );
}
