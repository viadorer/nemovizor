"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { getBrowserSupabase } from "@/lib/supabase-browser";
import Link from "next/link";
import { PurchaseDialog } from "@/components/purchase-dialog";

/**
 * Shows Edit + TIP/TOP buttons on property detail page
 * only if the logged-in user is the broker who owns this property.
 */
export function EditPropertyButton({ propertyId }: { propertyId: string }) {
  const { user } = useAuth();
  const [canEdit, setCanEdit] = useState(false);
  const [isFeatured, setIsFeatured] = useState(false);
  const [purchaseCode, setPurchaseCode] = useState<string | null>(null);

  useEffect(() => {
    if (!user || !propertyId) return;
    const supabase = getBrowserSupabase();
    if (!supabase) return;

    (async () => {
      const { data: prop } = await supabase
        .from("properties")
        .select("broker_id, created_by, featured, featured_until")
        .eq("id", propertyId)
        .single();

      if (!prop) return;

      setIsFeatured(prop.featured && (!prop.featured_until || new Date(prop.featured_until) > new Date()));

      if (prop.created_by === user.id) { setCanEdit(true); return; }

      const { data: broker } = await supabase
        .from("brokers")
        .select("id, agency_id")
        .eq("user_id", user.id)
        .single();

      if (!broker) return;

      if (prop.broker_id === broker.id) { setCanEdit(true); return; }

      if (broker.agency_id && prop.broker_id) {
        const { data: propBroker } = await supabase
          .from("brokers")
          .select("agency_id")
          .eq("id", prop.broker_id)
          .single();
        if (propBroker?.agency_id === broker.agency_id) { setCanEdit(true); return; }
      }

      const { data: agency } = await supabase
        .from("agencies")
        .select("id")
        .eq("user_id", user.id)
        .single();

      if (agency && prop.broker_id) {
        const { data: propBroker } = await supabase
          .from("brokers")
          .select("agency_id")
          .eq("id", prop.broker_id)
          .single();
        if (propBroker?.agency_id === agency.id) { setCanEdit(true); return; }
      }
    })();
  }, [user, propertyId]);

  if (!canEdit) return null;

  return (
    <>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <Link
          href={`/dashboard/moje-inzeraty/${propertyId}/upravit`}
          className="detail-edit-btn"
          style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            padding: "6px 14px", borderRadius: 8,
            background: "var(--color-accent, #ffb800)", color: "#000",
            fontWeight: 600, fontSize: "0.82rem", textDecoration: "none",
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
          </svg>
          Upravit
        </Link>

        {!isFeatured && (
          <button
            onClick={() => setPurchaseCode("tip_7d")}
            style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              padding: "6px 14px", borderRadius: 8,
              border: "1px solid var(--color-accent, #ffb800)", background: "transparent",
              color: "var(--color-accent, #ffb800)", fontWeight: 600, fontSize: "0.82rem", cursor: "pointer",
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" /></svg>
            TIP
          </button>
        )}

        {isFeatured && (
          <span style={{ padding: "6px 14px", borderRadius: 8, background: "rgba(34,197,94,0.1)", color: "#22c55e", fontWeight: 600, fontSize: "0.82rem" }}>
            TIP aktivní
          </span>
        )}

        <button
          onClick={() => setPurchaseCode("top_listing_7d")}
          style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            padding: "6px 14px", borderRadius: 8,
            border: "1px solid var(--border)", background: "transparent",
            color: "var(--text)", fontWeight: 600, fontSize: "0.82rem", cursor: "pointer",
          }}
        >
          TOP pozice
        </button>
      </div>

      {purchaseCode && (
        <PurchaseDialog
          serviceCode={purchaseCode}
          targetId={propertyId}
          targetType="property"
          onSuccess={() => { setPurchaseCode(null); window.location.reload(); }}
          onClose={() => setPurchaseCode(null)}
        />
      )}
    </>
  );
}
