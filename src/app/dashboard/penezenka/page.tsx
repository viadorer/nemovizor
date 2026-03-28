"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { useT } from "@/i18n/provider";

type Wallet = {
  id: string; credits: number; discount_pct: number; promo_balance: number; frozen: boolean;
};
type ExchangeRate = { currency: string; currency_label: string; credits_per_unit: number };
type Transaction = {
  id: string; type: string; amount_display: number; credits: number;
  balance_after_display: number; category: string; description: string | null;
  reference_type: string | null; created_at: string; country?: string; currency?: string;
};
type DaySummary = {
  date: string; creditSum: number; debitSum: number; count: number; transactions: Transaction[];
};

const TYPE_LABELS: Record<string, string> = { credit: "Příjem", debit: "Výdaj", hold: "Blokace", release: "Uvolnění", refund: "Vrácení" };
const TYPE_COLORS: Record<string, string> = { credit: "#22c55e", debit: "#ef4444", hold: "#f59e0b", release: "#3b82f6", refund: "#8b5cf6" };
const CATEGORY_LABELS: Record<string, string> = {
  deposit: "Dobití kreditů", tip_purchase: "TIP", listing_fee: "Inzerce", daily_billing: "Denní inzerce",
  broker_promo: "Promo makléře", project_page: "Stránka projektu", refund: "Vrácení",
  bonus: "Bonus", admin_adjustment: "Úprava", agency_promo: "Promo kanceláře",
};

function formatDateLabel(dateStr: string): string {
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400_000).toISOString().slice(0, 10);
  if (dateStr === today) return "Dnes";
  if (dateStr === yesterday) return "Včera";
  return new Date(dateStr + "T00:00:00").toLocaleDateString("cs-CZ", { weekday: "short", day: "numeric", month: "long", year: "numeric" });
}

export default function WalletPage() {
  const { user } = useAuth();
  const t = useT();
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [rates, setRates] = useState<ExchangeRate[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [txTotal, setTxTotal] = useState(0);
  const [txPage, setTxPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [txLoading, setTxLoading] = useState(false);
  const [expandedDays, setExpandedDays] = useState<Set<string>>(new Set());
  const TX_LIMIT = 200;

  // Load wallet
  useEffect(() => {
    if (!user) return;
    fetch("/api/wallet")
      .then((r) => r.json())
      .then((d) => { setWallet(d.wallet); setRates(d.exchangeRates || []); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user]);

  // Load transactions
  useEffect(() => {
    if (!wallet) return;
    setTxLoading(true);
    fetch(`/api/wallet/transactions?wallet_id=${wallet.id}&page=${txPage}&limit=${TX_LIMIT}`)
      .then((r) => r.json())
      .then((d) => { setTransactions(d.transactions || []); setTxTotal(d.total || 0); })
      .catch(() => {})
      .finally(() => setTxLoading(false));
  }, [wallet, txPage]);

  // Group by day
  const daySummaries: DaySummary[] = [];
  const dayMap = new Map<string, Transaction[]>();
  for (const tx of transactions) {
    const date = tx.created_at.slice(0, 10);
    if (!dayMap.has(date)) dayMap.set(date, []);
    dayMap.get(date)!.push(tx);
  }
  for (const [date, txs] of dayMap) {
    let creditSum = 0, debitSum = 0;
    for (const tx of txs) {
      const amt = tx.credits || tx.amount_display;
      if (tx.type === "credit" || tx.type === "refund" || tx.type === "release") creditSum += amt;
      else debitSum += amt;
    }
    daySummaries.push({ date, creditSum, debitSum, count: txs.length, transactions: txs });
  }

  const toggleDay = (date: string) => {
    setExpandedDays((prev) => { const n = new Set(prev); if (n.has(date)) n.delete(date); else n.add(date); return n; });
  };

  const txPages = Math.ceil(txTotal / TX_LIMIT);

  if (loading) return <div className="dashboard-page"><p style={{ color: "var(--text-muted)" }}>{t.common.loading}</p></div>;

  if (!wallet) return (
    <div className="dashboard-page">
      <h1 className="dashboard-page-title">Peněženka</h1>
      <div className="dashboard-empty">
        <p>Zatím nemáte peněženku. Bude vytvořena automaticky.</p>
      </div>
    </div>
  );

  return (
    <div className="dashboard-page">
      <h1 className="dashboard-page-title">Peněženka</h1>

      {/* ── Credit balance card ────────────────────────────────── */}
      <div style={{
        background: "linear-gradient(135deg, var(--bg-card) 0%, var(--bg-filter, #f8f8f8) 100%)",
        borderRadius: 16, padding: "28px 32px", border: "1px solid var(--border)", marginBottom: 28,
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 24 }}>
          <div>
            <div style={{ fontSize: "0.78rem", color: "var(--text-muted)", fontWeight: 500, marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.5px" }}>
              Zůstatek
            </div>
            <div style={{ fontSize: "2.5rem", fontWeight: 800, lineHeight: 1.2 }}>
              {wallet.credits.toLocaleString("cs")} <span style={{ fontSize: "1rem", fontWeight: 500, color: "var(--text-muted)" }}>kreditů</span>
            </div>
            {wallet.discount_pct > 0 && (
              <div style={{ fontSize: "0.82rem", color: "#22c55e", fontWeight: 600, marginTop: 4 }}>
                Sleva na účtu: {wallet.discount_pct}%
              </div>
            )}
            {wallet.promo_balance > 0 && (
              <div style={{ fontSize: "0.82rem", color: "#8b5cf6", marginTop: 2 }}>
                + {wallet.promo_balance.toLocaleString("cs")} promo kreditů
              </div>
            )}
            {wallet.frozen && (
              <div style={{ fontSize: "0.82rem", color: "#ef4444", fontWeight: 600, marginTop: 4 }}>
                Peněženka je zmrazená
              </div>
            )}
          </div>

          <div style={{ fontSize: "0.82rem", color: "var(--text-muted)" }}>
            Celkem transakcí: {txTotal}
          </div>
        </div>
      </div>

      {/* ── Exchange rates ─────────────────────────────────────── */}
      {rates.length > 0 && (
        <div style={{ marginBottom: 28 }}>
          <h2 style={{ fontSize: "0.9rem", fontWeight: 600, marginBottom: 10 }}>Kurzy kreditů</h2>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
            {rates.map((r) => (
              <div key={r.currency} style={{
                background: "var(--bg-card)", borderRadius: 10, padding: "10px 16px",
                border: "1px solid var(--border)", fontSize: "0.82rem",
              }}>
                <span style={{ fontWeight: 600 }}>1 {r.currency_label || r.currency.toUpperCase()}</span>
                <span style={{ color: "var(--text-muted)", margin: "0 6px" }}>=</span>
                <span style={{ fontWeight: 700 }}>{r.credits_per_unit} kr</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Transaction history ────────────────────────────────── */}
      <h2 style={{ fontSize: "0.9rem", fontWeight: 600, marginBottom: 10 }}>Historie transakcí</h2>

      {txLoading ? (
        <p style={{ color: "var(--text-muted)" }}>{t.common.loading}</p>
      ) : daySummaries.length === 0 ? (
        <p style={{ color: "var(--text-muted)" }}>Zatím žádné transakce.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {daySummaries.map((day) => {
            const isExpanded = expandedDays.has(day.date);
            return (
              <div key={day.date} style={{ background: "var(--bg-card)", borderRadius: 12, border: "1px solid var(--border)", overflow: "hidden" }}>
                <button onClick={() => toggleDay(day.date)}
                  style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 20px", border: "none", background: "transparent", cursor: "pointer", textAlign: "left", gap: 16 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12, flex: 1 }}>
                    <span style={{ fontSize: "1rem", transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)", transition: "transform 0.15s" }}>▶</span>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: "0.9rem" }}>{formatDateLabel(day.date)}</div>
                      <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                        {day.count} {day.count === 1 ? "transakce" : day.count < 5 ? "transakce" : "transakcí"}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 16, alignItems: "center", flexShrink: 0 }}>
                    {day.creditSum > 0 && <span style={{ fontWeight: 700, color: "#22c55e", fontSize: "0.88rem" }}>+{day.creditSum.toLocaleString("cs")} kr</span>}
                    {day.debitSum > 0 && <span style={{ fontWeight: 700, color: "#ef4444", fontSize: "0.88rem" }}>-{day.debitSum.toLocaleString("cs")} kr</span>}
                  </div>
                </button>

                {isExpanded && (
                  <div style={{ borderTop: "1px solid var(--border)", padding: "4px 12px 12px" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse" }}>
                      <thead>
                        <tr>
                          <th style={{ textAlign: "left", padding: "6px 8px", fontSize: "0.72rem", color: "var(--text-muted)", fontWeight: 500 }}>Čas</th>
                          <th style={{ textAlign: "left", padding: "6px 8px", fontSize: "0.72rem", color: "var(--text-muted)", fontWeight: 500 }}>Typ</th>
                          <th style={{ textAlign: "left", padding: "6px 8px", fontSize: "0.72rem", color: "var(--text-muted)", fontWeight: 500 }}>Kategorie</th>
                          <th style={{ textAlign: "left", padding: "6px 8px", fontSize: "0.72rem", color: "var(--text-muted)", fontWeight: 500 }}>Popis</th>
                          <th style={{ textAlign: "right", padding: "6px 8px", fontSize: "0.72rem", color: "var(--text-muted)", fontWeight: 500 }}>Kredity</th>
                        </tr>
                      </thead>
                      <tbody>
                        {day.transactions.map((tx) => {
                          const isCredit = tx.type === "credit" || tx.type === "refund" || tx.type === "release";
                          const amt = tx.credits || tx.amount_display;
                          return (
                            <tr key={tx.id} style={{ borderTop: "1px solid var(--border)" }}>
                              <td style={{ padding: "8px", fontSize: "0.8rem", color: "var(--text-muted)", whiteSpace: "nowrap" }}>
                                {new Date(tx.created_at).toLocaleTimeString("cs-CZ", { hour: "2-digit", minute: "2-digit" })}
                              </td>
                              <td style={{ padding: "8px" }}>
                                <span style={{ fontSize: "0.78rem", fontWeight: 600, color: TYPE_COLORS[tx.type] || "var(--text)" }}>
                                  {TYPE_LABELS[tx.type] || tx.type}
                                </span>
                              </td>
                              <td style={{ padding: "8px", fontSize: "0.8rem" }}>
                                {CATEGORY_LABELS[tx.category] || tx.category}
                              </td>
                              <td style={{ padding: "8px", fontSize: "0.8rem", color: "var(--text-muted)", maxWidth: 300, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={tx.description || ""}>
                                {tx.description || "—"}
                              </td>
                              <td style={{ padding: "8px", textAlign: "right", fontWeight: 700, fontSize: "0.85rem", color: isCredit ? "#22c55e" : "#ef4444" }}>
                                {isCredit ? "+" : "-"}{amt.toLocaleString("cs")} kr
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

      {txPages > 1 && (
        <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 16, alignItems: "center" }}>
          <button disabled={txPage <= 1} onClick={() => setTxPage(txPage - 1)}
            style={{ padding: "6px 14px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-card)", cursor: txPage > 1 ? "pointer" : "default", opacity: txPage <= 1 ? 0.4 : 1 }}>← Novější</button>
          <span style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>{txPage} / {txPages}</span>
          <button disabled={txPage >= txPages} onClick={() => setTxPage(txPage + 1)}
            style={{ padding: "6px 14px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-card)", cursor: txPage < txPages ? "pointer" : "default", opacity: txPage >= txPages ? 0.4 : 1 }}>Starší →</button>
        </div>
      )}
    </div>
  );
}
