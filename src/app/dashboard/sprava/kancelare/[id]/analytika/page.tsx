"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import ScopedAnalytics from "@/components/admin/scoped-analytics";

export default function AgencyAnalyticsAdmin() {
  const { id } = useParams() as { id: string };
  const [name, setName] = useState("");

  useEffect(() => {
    fetch(`/api/admin/agencies?id=${id}`)
      .then((r) => r.json())
      .then((d) => { if (d?.name) setName(d.name); })
      .catch(() => {});
  }, [id]);

  return (
    <div className="dashboard-page">
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
        <Link href="/dashboard/sprava/kancelare" style={{ color: "var(--text-muted)", textDecoration: "none", fontSize: "0.85rem" }}>&larr; Kanceláře</Link>
        <h1 className="dashboard-page-title" style={{ marginBottom: 0 }}>
          Analytika — {name || "Kancelář"}
        </h1>
      </div>
      <ScopedAnalytics agencyId={id} />
    </div>
  );
}
