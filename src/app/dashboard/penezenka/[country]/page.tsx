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

const COUNTRY_NAMES: Record<string, string> = {
  cz: "Česko", sk: "Slovensko", de: "Německo", at: "Rakousko", ch: "Švýcarsko",
  fr: "Francie", it: "Itálie", es: "Španělsko", pt: "Portugalsko", gb: "Velká Británie",
  be: "Belgie", hu: "Maďarsko", hr: "Chorvatsko", gr: "Řecko", bg: "Bulharsko",
};

const COUNTRY_FLAGS: Record<string, string> = {
  cz: "🇨🇿", sk: "🇸🇰", de: "🇩🇪", at: "🇦🇹", ch: "🇨🇭",
  fr: "🇫🇷", it: "🇮🇹", es: "🇪🇸", pt: "🇵🇹", gb: "🇬🇧",
  be: "🇧🇪", hu: "🇭🇺", hr: "🇭🇷", gr: "🇬🇷", bg: "🇧🇬",
};

const CURRENCY_SYMBOLS: Record<string, string> = { czk: "Kč", eur: "€", chf: "CHF", gbp: "£" };

const TYPE_LABELS: Record<string, string> = { credit: "Příjem", debit: "Výdaj", hold: "Blokace", release: "Uvolnění", refund: "Vrácení" };
const TYPE_COLORS: Record<string, string> = { credit: "#22c55e", debit: "#ef4444", hold: "#f59e0b", release: "#3b82f6", refund: "#8b5cf6" };

const CATEGORY_LABELS: Record<string, string> = {
  deposit: "Dobití", tip_purchase: "TIP", listing_fee: "Inzerce", broker_promo: "Promo makléře",
  project_page: "Stránka projektu", refund: "Vrácení", bonus: "Bonus", admin_adjustment: "Úprava admin",
  agency_promo: "Promo kanceláře",
};

function fmt(n: number, cur: string) {
  return `${n.toLocaleString("cs", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${CURRENCY_SYMBOLS[cur] || cur.toUpperCase()}`;
}

export default function WalletDetailPage() {
  const { country } = useParams() as { country: string };
  const { user } = useAuth();
  const t = useT();
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const PAGE_SIZE = 20;

  // Load wallet
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

  // Load transactions
  const loadTransactions = useCallback(async () => {
    if (!wallet) return;
    const res = await fetch(`/api/wallet/transactions?wallet_id=${wallet.id}&page=${page}&limit=${PAGE_SIZE}`);
    const data = await res.json();
    setTransactions(data.transactions || []);
    setTotal(data.total || 0);
  }, [wallet, page]);

  useEffect(() => { loadTransactions(); }, [loadTransactions]);

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

      {/* Balance card */}
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
        {wallet.frozen && (
          <div className="admin-stat-card" style={{ borderColor: "#ef4444" }}>
            <div className="label" style={{ color: "#ef4444" }}>Stav</div>
            <div className="value" style={{ color: "#ef4444" }}>Zmrazená</div>
          </div>
        )}
      </div>

      {/* Transaction history */}
      <h2 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: 12 }}>Historie transakcí</h2>

      {transactions.length === 0 ? (
        <p style={{ color: "var(--text-muted)" }}>Zatím žádné transakce.</p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table className="admin-table" style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left", padding: "8px 12px", borderBottom: "1px solid var(--border)", fontSize: 13, color: "var(--text-muted)" }}>Datum</th>
                <th style={{ textAlign: "left", padding: "8px 12px", borderBottom: "1px solid var(--border)", fontSize: 13, color: "var(--text-muted)" }}>Typ</th>
                <th style={{ textAlign: "left", padding: "8px 12px", borderBottom: "1px solid var(--border)", fontSize: 13, color: "var(--text-muted)" }}>Kategorie</th>
                <th style={{ textAlign: "left", padding: "8px 12px", borderBottom: "1px solid var(--border)", fontSize: 13, color: "var(--text-muted)" }}>Popis</th>
                <th style={{ textAlign: "right", padding: "8px 12px", borderBottom: "1px solid var(--border)", fontSize: 13, color: "var(--text-muted)" }}>Částka</th>
                <th style={{ textAlign: "right", padding: "8px 12px", borderBottom: "1px solid var(--border)", fontSize: 13, color: "var(--text-muted)" }}>Zůstatek</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((tx) => (
                <tr key={tx.id}>
                  <td style={{ padding: "10px 12px", borderBottom: "1px solid var(--border)", fontSize: "0.82rem", whiteSpace: "nowrap" }}>
                    {new Date(tx.created_at).toLocaleString("cs-CZ", { day: "numeric", month: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </td>
                  <td style={{ padding: "10px 12px", borderBottom: "1px solid var(--border)" }}>
                    <span style={{ fontSize: "0.78rem", fontWeight: 600, color: TYPE_COLORS[tx.type] || "var(--text)" }}>
                      {TYPE_LABELS[tx.type] || tx.type}
                    </span>
                  </td>
                  <td style={{ padding: "10px 12px", borderBottom: "1px solid var(--border)", fontSize: "0.82rem" }}>
                    {CATEGORY_LABELS[tx.category] || tx.category}
                  </td>
                  <td style={{ padding: "10px 12px", borderBottom: "1px solid var(--border)", fontSize: "0.82rem", color: "var(--text-muted)", maxWidth: 250, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {tx.description || "—"}
                  </td>
                  <td style={{ padding: "10px 12px", borderBottom: "1px solid var(--border)", textAlign: "right", fontWeight: 600, color: tx.type === "credit" || tx.type === "refund" ? "#22c55e" : "#ef4444" }}>
                    {tx.type === "credit" || tx.type === "refund" || tx.type === "release" ? "+" : "-"}{fmt(tx.amount_display, cur)}
                  </td>
                  <td style={{ padding: "10px 12px", borderBottom: "1px solid var(--border)", textAlign: "right", fontSize: "0.82rem", color: "var(--text-muted)" }}>
                    {fmt(tx.balance_after_display, cur)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 16, alignItems: "center" }}>
          <button disabled={page <= 1} onClick={() => setPage(page - 1)} style={{ padding: "6px 14px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-card)", cursor: page > 1 ? "pointer" : "default", opacity: page <= 1 ? 0.4 : 1 }}>←</button>
          <span style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>{page} / {totalPages}</span>
          <button disabled={page >= totalPages} onClick={() => setPage(page + 1)} style={{ padding: "6px 14px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-card)", cursor: page < totalPages ? "pointer" : "default", opacity: page >= totalPages ? 0.4 : 1 }}>→</button>
        </div>
      )}
    </div>
  );
}
