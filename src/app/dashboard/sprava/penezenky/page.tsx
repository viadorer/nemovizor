"use client";

import { useEffect, useState } from "react";
import { useT } from "@/i18n/provider";

type WalletRow = {
  id: string; user_id: string; country: string; currency: string;
  balance_display: number; credit_limit_display: number; frozen: boolean;
  created_at: string; updated_at: string;
};

const FLAGS: Record<string, string> = { cz: "🇨🇿", sk: "🇸🇰", de: "🇩🇪", at: "🇦🇹", ch: "🇨🇭", fr: "🇫🇷", it: "🇮🇹", es: "🇪🇸", pt: "🇵🇹", gb: "🇬🇧", be: "🇧🇪", hu: "🇭🇺", hr: "🇭🇷", gr: "🇬🇷" };
function fmt(n: number) { return `${n.toLocaleString("cs", { minimumFractionDigits: 2 })} kr`; }

export default function AdminWalletsPage() {
  const t = useT();
  const [wallets, setWallets] = useState<WalletRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [topUpWallet, setTopUpWallet] = useState<string | null>(null);
  const [topUpAmount, setTopUpAmount] = useState("");
  const [topUpDesc, setTopUpDesc] = useState("");

  useEffect(() => {
    fetch("/api/admin/wallets?limit=100")
      .then((r) => r.json())
      .then((d) => setWallets(d.wallets || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function handleTopUp(walletId: string) {
    const amount = parseFloat(topUpAmount);
    if (!amount || amount <= 0) return;
    const res = await fetch("/api/admin/wallets", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ wallet_id: walletId, action: "credit", amount, description: topUpDesc || undefined }),
    });
    if (res.ok) {
      setTopUpWallet(null); setTopUpAmount(""); setTopUpDesc("");
      // Refresh
      const d = await (await fetch("/api/admin/wallets?limit=100")).json();
      setWallets(d.wallets || []);
    }
  }

  async function toggleFreeze(walletId: string, frozen: boolean) {
    await fetch("/api/admin/wallets", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ wallet_id: walletId, action: frozen ? "unfreeze" : "freeze" }),
    });
    setWallets((prev) => prev.map((w) => w.id === walletId ? { ...w, frozen: !frozen } : w));
  }

  return (
    <div className="dashboard-page">
      <h1 className="dashboard-page-title">Správa peněženek</h1>

      {loading ? <p style={{ color: "var(--text-muted)" }}>{t.common.loading}</p> : wallets.length === 0 ? (
        <p style={{ color: "var(--text-muted)" }}>Žádné peněženky.</p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table className="admin-table" style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left", padding: "8px 12px", borderBottom: "1px solid var(--border)", fontSize: 13, color: "var(--text-muted)" }}>Uživatel</th>
                <th style={{ textAlign: "left", padding: "8px 12px", borderBottom: "1px solid var(--border)", fontSize: 13, color: "var(--text-muted)" }}>Země</th>
                <th style={{ textAlign: "right", padding: "8px 12px", borderBottom: "1px solid var(--border)", fontSize: 13, color: "var(--text-muted)" }}>Zůstatek</th>
                <th style={{ textAlign: "right", padding: "8px 12px", borderBottom: "1px solid var(--border)", fontSize: 13, color: "var(--text-muted)" }}>Kredit. limit</th>
                <th style={{ textAlign: "center", padding: "8px 12px", borderBottom: "1px solid var(--border)", fontSize: 13, color: "var(--text-muted)" }}>Stav</th>
                <th style={{ textAlign: "right", padding: "8px 12px", borderBottom: "1px solid var(--border)", fontSize: 13, color: "var(--text-muted)" }}>Akce</th>
              </tr>
            </thead>
            <tbody>
              {wallets.map((w) => (
                <tr key={w.id}>
                  <td style={{ padding: "10px 12px", borderBottom: "1px solid var(--border)", fontSize: "0.82rem" }}>
                    {w.user_id.slice(0, 8)}...
                  </td>
                  <td style={{ padding: "10px 12px", borderBottom: "1px solid var(--border)" }}>
                    {FLAGS[w.country] || ""} {w.country.toUpperCase()}
                  </td>
                  <td style={{ padding: "10px 12px", borderBottom: "1px solid var(--border)", textAlign: "right", fontWeight: 600 }}>
                    {fmt(w.balance_display)}
                  </td>
                  <td style={{ padding: "10px 12px", borderBottom: "1px solid var(--border)", textAlign: "right", fontSize: "0.82rem", color: "var(--text-muted)" }}>
                    {w.credit_limit_display > 0 ? fmt(w.credit_limit_display) : "—"}
                  </td>
                  <td style={{ padding: "10px 12px", borderBottom: "1px solid var(--border)", textAlign: "center" }}>
                    <span style={{ fontSize: "0.78rem", fontWeight: 600, color: w.frozen ? "#ef4444" : "#22c55e" }}>
                      {w.frozen ? "Zmrazená" : "Aktivní"}
                    </span>
                  </td>
                  <td style={{ padding: "10px 12px", borderBottom: "1px solid var(--border)", textAlign: "right" }}>
                    <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                      <button className="admin-btn admin-btn--primary" style={{ fontSize: "0.75rem", padding: "4px 10px" }} onClick={() => setTopUpWallet(topUpWallet === w.id ? null : w.id)}>Dobít</button>
                      <button className="admin-btn" style={{ fontSize: "0.75rem", padding: "4px 10px" }} onClick={() => toggleFreeze(w.id, w.frozen)}>
                        {w.frozen ? "Odblokovat" : "Zmrazit"}
                      </button>
                    </div>
                    {topUpWallet === w.id && (
                      <div style={{ marginTop: 8, display: "flex", gap: 6, justifyContent: "flex-end", flexWrap: "wrap" }}>
                        <input type="number" placeholder="Částka" value={topUpAmount} onChange={(e) => setTopUpAmount(e.target.value)} style={{ width: 100, padding: "4px 8px", borderRadius: 6, border: "1px solid var(--border)", fontSize: "0.82rem" }} />
                        <input type="text" placeholder="Popis" value={topUpDesc} onChange={(e) => setTopUpDesc(e.target.value)} style={{ width: 140, padding: "4px 8px", borderRadius: 6, border: "1px solid var(--border)", fontSize: "0.82rem" }} />
                        <button className="admin-btn admin-btn--primary" style={{ fontSize: "0.75rem", padding: "4px 10px" }} onClick={() => handleTopUp(w.id)}>OK</button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
