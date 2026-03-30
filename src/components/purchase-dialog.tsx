"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

type PurchaseDialogProps = {
  serviceCode: string;
  targetId: string;
  targetType: "property" | "broker" | "agency";
  onSuccess?: () => void;
  onClose: () => void;
};

type Quote = {
  service_code: string;
  name: string;
  description: string;
  duration_days: number | null;
  price: number;
  wallet_credits: number;
  can_afford: boolean;
};

export function PurchaseDialog({ serviceCode, targetId, targetType, onSuccess, onClose }: PurchaseDialogProps) {
  const [quote, setQuote] = useState<Quote | null>(null);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    fetch(`/api/wallet/purchase?service_code=${serviceCode}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) setError(data.error);
        else setQuote(data);
      })
      .catch(() => setError("Nepodařilo se načíst cenu"))
      .finally(() => setLoading(false));
  }, [serviceCode]);

  async function handlePurchase() {
    if (!quote) return;
    setPurchasing(true);
    setError(null);

    try {
      const body: Record<string, string> = { service_code: serviceCode };
      if (targetType === "property") body.property_id = targetId;
      if (targetType === "broker") body.broker_id = targetId;
      if (targetType === "agency") body.agency_id = targetId;

      const res = await fetch("/api/wallet/purchase", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Nákup se nezdařil");
        return;
      }

      setSuccess(true);
      setTimeout(() => {
        onSuccess?.();
        onClose();
      }, 2000);
    } catch {
      setError("Chyba při nákupu");
    } finally {
      setPurchasing(false);
    }
  }

  return (
    <div className="purchase-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="purchase-dialog">
        {/* Header */}
        <div className="purchase-header">
          <h3>Nákup služby</h3>
          <button onClick={onClose} className="purchase-close">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
          </button>
        </div>

        {/* Content */}
        <div className="purchase-body">
          {loading && <p style={{ color: "var(--text-muted)" }}>Načítám...</p>}

          {error && !success && (
            <div className="purchase-error">{error}</div>
          )}

          {success && (
            <div className="purchase-success">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><path d="M22 4L12 14.01l-3-3" /></svg>
              <p>Služba aktivována!</p>
            </div>
          )}

          {quote && !success && (
            <>
              <div className="purchase-service-name">{quote.name}</div>
              {quote.description && <p className="purchase-description">{quote.description}</p>}
              {quote.duration_days && <p className="purchase-duration">Platnost: {quote.duration_days} dní</p>}

              <div className="purchase-price-row">
                <span>Cena</span>
                <span className="purchase-price">{quote.price} kr</span>
              </div>
              <div className="purchase-price-row">
                <span>Váš zůstatek</span>
                <span style={{ color: quote.can_afford ? "var(--text)" : "#ef4444", fontWeight: 600 }}>
                  {typeof quote.wallet_credits === "number" ? quote.wallet_credits.toLocaleString("cs") : "0"} kr
                </span>
              </div>
              {!quote.can_afford && (
                <div className="purchase-price-row" style={{ borderTop: "1px solid var(--border)", paddingTop: 12 }}>
                  <span style={{ color: "#ef4444", fontSize: "0.85rem" }}>Nedostatečný zůstatek</span>
                  <Link href="/dashboard/penezenka" className="purchase-topup-link">Dobít kredity</Link>
                </div>
              )}
            </>
          )}
        </div>

        {/* Actions */}
        {quote && !success && (
          <div className="purchase-actions">
            <button onClick={onClose} className="purchase-btn-cancel">Zrušit</button>
            <button
              onClick={handlePurchase}
              disabled={!quote.can_afford || purchasing}
              className="purchase-btn-confirm"
            >
              {purchasing ? "Zpracovávám..." : `Koupit za ${quote.price} kr`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
