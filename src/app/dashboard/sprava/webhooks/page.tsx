"use client";

import { useCallback, useEffect, useState } from "react";

type SubRow = {
  id: string;
  owner_type: "broker" | "agency" | "admin";
  owner_id: string;
  url: string;
  secret_prefix: string;
  event_types: string[];
  filter: Record<string, unknown> | null;
  active: boolean;
  failure_count: number;
  disabled_at: string | null;
  last_delivered_at: string | null;
  created_at: string;
};

type DeliveryRow = {
  id: string;
  outbox_id: string;
  subscription_id: string;
  attempt: number;
  status: "success" | "failure";
  http_status: number | null;
  latency_ms: number;
  created_at: string;
};

type Resp = {
  data: SubRow[];
  outbox_stats: Record<string, number>;
  deliveries?: DeliveryRow[];
};

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("cs-CZ", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function statusOf(row: SubRow): { label: string; color: string } {
  if (row.disabled_at) return { label: "Auto-disabled", color: "#b91c1c" };
  if (!row.active) return { label: "Pozastaveno", color: "#9333ea" };
  if (row.failure_count > 0) return { label: `${row.failure_count} fails`, color: "#b45309" };
  return { label: "Aktivní", color: "#15803d" };
}

export default function AdminWebhooksPage() {
  const [data, setData] = useState<Resp | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/webhooks?include_deliveries=true", { cache: "no-store" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error?.message || `HTTP ${res.status}`);
      }
      setData((await res.json()) as Resp);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const stats = data?.outbox_stats || {};

  return (
    <div style={{ padding: "1.5rem", maxWidth: 1400, margin: "0 auto" }}>
      <div style={{ marginBottom: "1.5rem" }}>
        <h1 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: 4 }}>Webhooks</h1>
        <p style={{ color: "var(--text-muted, #6b7280)", fontSize: "0.875rem" }}>
          Outbound webhook subscriptions napříč všemi brokery a agenturami. Klienti si je vytvářejí přes `POST /api/v1/webhooks` (vyžaduje API key se scope `write:webhooks`). Cron `*/5 * * * *` je dispatchuje s HMAC-SHA256 podpisem.
        </p>
      </div>

      {error && (
        <div
          style={{
            padding: "0.75rem 1rem",
            background: "#fef2f2",
            color: "#991b1b",
            border: "1px solid #fecaca",
            borderRadius: 6,
            marginBottom: "1rem",
          }}
        >
          {error}
        </div>
      )}

      {/* Outbox stats */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
          gap: "0.75rem",
          marginBottom: "1.5rem",
        }}
      >
        <Kpi label="Pending" value={stats.pending || 0} color="#9333ea" />
        <Kpi label="Delivering" value={stats.delivering || 0} color="#b45309" />
        <Kpi label="Delivered" value={stats.delivered || 0} color="#15803d" />
        <Kpi label="Failed" value={stats.failed || 0} color="#b91c1c" />
        <Kpi label="Active subscriptions" value={(data?.data || []).filter((s) => s.active && !s.disabled_at).length} />
      </div>

      {/* Subscriptions table */}
      <h2 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: 8 }}>Subscriptions</h2>
      <div style={{ border: "1px solid var(--border, #e5e7eb)", borderRadius: 8, overflow: "auto", marginBottom: "2rem" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.75rem" }}>
          <thead style={{ background: "var(--bg-muted, #f9fafb)" }}>
            <tr>
              <th style={th}>URL</th>
              <th style={th}>Owner</th>
              <th style={th}>Events</th>
              <th style={th}>Filter</th>
              <th style={th}>Stav</th>
              <th style={th}>Last delivery</th>
              <th style={th}>Vytvořen</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={7} style={{ padding: "2rem", textAlign: "center", color: "var(--text-muted, #6b7280)" }}>
                  Načítání…
                </td>
              </tr>
            )}
            {!loading && (data?.data || []).length === 0 && (
              <tr>
                <td colSpan={7} style={{ padding: "2rem", textAlign: "center", color: "var(--text-muted, #6b7280)" }}>
                  Žádné webhook subscriptions.
                </td>
              </tr>
            )}
            {!loading &&
              data?.data.map((row) => {
                const st = statusOf(row);
                return (
                  <tr key={row.id} style={{ borderTop: "1px solid var(--border, #e5e7eb)" }}>
                    <td style={{ ...td, fontFamily: "monospace", maxWidth: 320, wordBreak: "break-all" }}>{row.url}</td>
                    <td style={td}>
                      <div>{row.owner_type}</div>
                      <div style={{ fontFamily: "monospace", fontSize: "0.65rem", color: "var(--text-muted, #6b7280)" }}>
                        {row.owner_id.slice(0, 8)}…{row.owner_id.slice(-4)}
                      </div>
                    </td>
                    <td style={td}>
                      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                        {row.event_types.map((e) => (
                          <span key={e} style={{ fontFamily: "monospace", fontSize: "0.65rem" }}>
                            {e}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td style={{ ...td, maxWidth: 220, fontFamily: "monospace", fontSize: "0.65rem" }}>
                      {row.filter ? JSON.stringify(row.filter) : "—"}
                    </td>
                    <td style={{ ...td, color: st.color, fontWeight: 600 }}>{st.label}</td>
                    <td style={td}>{fmtDate(row.last_delivered_at)}</td>
                    <td style={td}>{fmtDate(row.created_at)}</td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>

      {/* Deliveries table */}
      {data?.deliveries && data.deliveries.length > 0 && (
        <>
          <h2 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: 8 }}>Recent deliveries (last 50)</h2>
          <div style={{ border: "1px solid var(--border, #e5e7eb)", borderRadius: 8, overflow: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.75rem" }}>
              <thead style={{ background: "var(--bg-muted, #f9fafb)" }}>
                <tr>
                  <th style={th}>Time</th>
                  <th style={th}>Subscription</th>
                  <th style={th}>Outbox</th>
                  <th style={th}>Attempt</th>
                  <th style={th}>HTTP</th>
                  <th style={th}>Latency</th>
                  <th style={th}>Status</th>
                </tr>
              </thead>
              <tbody>
                {data.deliveries.map((d) => (
                  <tr key={d.id} style={{ borderTop: "1px solid var(--border, #e5e7eb)" }}>
                    <td style={td}>{fmtDate(d.created_at)}</td>
                    <td style={{ ...td, fontFamily: "monospace", fontSize: "0.65rem" }}>{d.subscription_id.slice(0, 8)}…</td>
                    <td style={{ ...td, fontFamily: "monospace", fontSize: "0.65rem" }}>{d.outbox_id.slice(0, 8)}…</td>
                    <td style={td}>#{d.attempt}</td>
                    <td style={td}>{d.http_status ?? "—"}</td>
                    <td style={td}>{d.latency_ms} ms</td>
                    <td style={{ ...td, color: d.status === "success" ? "#15803d" : "#b91c1c", fontWeight: 600 }}>
                      {d.status}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function Kpi({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div
      style={{
        padding: "0.75rem 1rem",
        border: "1px solid var(--border, #e5e7eb)",
        borderRadius: 8,
        background: "var(--bg-card, white)",
      }}
    >
      <div style={{ fontSize: "0.7rem", color: "var(--text-muted, #6b7280)", textTransform: "uppercase", letterSpacing: "0.03em" }}>
        {label}
      </div>
      <div style={{ fontSize: "1.5rem", fontWeight: 700, color: color || undefined }}>{value.toLocaleString("cs-CZ")}</div>
    </div>
  );
}

const th: React.CSSProperties = {
  textAlign: "left",
  padding: "0.6rem",
  fontSize: "0.7rem",
  fontWeight: 600,
  textTransform: "uppercase",
  letterSpacing: "0.03em",
  color: "var(--text-muted, #6b7280)",
};

const td: React.CSSProperties = {
  padding: "0.6rem",
  verticalAlign: "top",
};
