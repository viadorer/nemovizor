"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import ScopedAnalytics from "@/components/admin/scoped-analytics";

export default function BrokerAnalyticsAdmin() {
  const { id } = useParams() as { id: string };
  const [name, setName] = useState("");

  useEffect(() => {
    fetch(`/api/admin/brokers?id=${id}`)
      .then((r) => r.json())
      .then((d) => { if (d?.name) setName(d.name); })
      .catch(() => {});
  }, [id]);

  return (
    <div className="dashboard-page">
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
        <Link href="/dashboard/sprava/makleri" style={{ color: "var(--text-muted)", textDecoration: "none", fontSize: "0.85rem" }}>&larr; Makléři</Link>
        <h1 className="dashboard-page-title" style={{ marginBottom: 0 }}>
          Analytika — {name || "Makléř"}
        </h1>
      </div>
      <ScopedAnalytics brokerId={id} />
    </div>
  );
}
