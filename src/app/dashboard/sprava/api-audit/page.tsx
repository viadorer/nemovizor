"use client";

import { useCallback, useEffect, useState } from "react";

type AuditRow = {
  id: string;
  api_key_id: string | null;
  client_hash: string | null;
  endpoint: string;
  method: string;
  status: number;
  latency_ms: number;
  created_at: string;
};

type Aggregate = {
  window_total: number;
  success: number;
  client_error: number;
  server_error: number;
  rate_limited: number;
  avg_latency_ms: number;
};

type AuditResponse = {
  data: AuditRow[];
  total: number;
  aggregate: Aggregate;
  window_since: string;
  limit: number;
};

function fmtDateTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString("cs-CZ", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return iso;
  }
}

function statusColor(s: number): string {
  if (s >= 200 && s < 300) return "#15803d";
  if (s === 429) return "#b45309";
  if (s >= 400 && s < 500) return "#9333ea";
  if (s >= 500) return "#b91c1c";
  return "#6b7280";
}

export default function AdminApiAuditPage() {
  const [data, setData] = useState<AuditResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [filterEndpoint, setFilterEndpoint] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterApiKeyId, setFilterApiKeyId] = useState("");
  const [windowHours, setWindowHours] = useState("24");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      const since = new Date(Date.now() - parseInt(windowHours, 10) * 3_600_000).toISOString();
      params.set("since", since);
      params.set("limit", "200");
      if (filterEndpoint) params.set("endpoint", filterEndpoint);
      if (filterStatus) params.set("status", filterStatus);
      if (filterApiKeyId) params.set("api_key_id", filterApiKeyId);

      const res = await fetch(`/api/admin/api-audit?${params}`, { cache: "no-store" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error?.message || `HTTP ${res.status}`);
      }
      const body = (await res.json()) as AuditResponse;
      setData(body);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [filterEndpoint, filterStatus, filterApiKeyId, windowHours]);

  useEffect(() => {
    load();
  }, [load]);

  const agg = data?.aggregate;

  return (
    <div style={{ padding: "1.5rem", maxWidth: 1400, margin: "0 auto" }}>
      <div style={{ marginBottom: "1.5rem" }}>
        <h1 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: 4 }}>API audit log</h1>
        <p style={{ color: "var(--text-muted, #6b7280)", fontSize: "0.875rem" }}>
          Per-request log všech volání veřejných /api/* endpointů. Anonymous IP jsou hashovány s denním saltem (nelze re-identifikovat). Retention 90 dní (cleanup cron běží denně ve 03:23 UTC).
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

      {/* Aggregate cards */}
      {agg && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: "0.75rem",
            marginBottom: "1.5rem",
          }}
        >
          <KpiCard label="Celkem requestů" value={agg.window_total.toLocaleString("cs-CZ")} />
          <KpiCard label="2xx (úspěch)" value={agg.success.toLocaleString("cs-CZ")} color="#15803d" />
          <KpiCard label="4xx (klient)" value={agg.client_error.toLocaleString("cs-CZ")} color="#9333ea" />
          <KpiCard label="5xx (server)" value={agg.server_error.toLocaleString("cs-CZ")} color="#b91c1c" />
          <KpiCard label="429 (rate limit)" value={agg.rate_limited.toLocaleString("cs-CZ")} color="#b45309" />
          <KpiCard label="Avg latency" value={`${agg.avg_latency_ms} ms`} />
        </div>
      )}

      {/* Filters */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 8,
          marginBottom: "1rem",
          padding: "0.75rem",
          border: "1px solid var(--border, #e5e7eb)",
          borderRadius: 8,
          alignItems: "flex-end",
        }}
      >
        <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span style={{ fontSize: "0.7rem", fontWeight: 600 }}>Time window</span>
          <select
            value={windowHours}
            onChange={(e) => setWindowHours(e.target.value)}
            style={{ padding: "0.4rem", borderRadius: 4, border: "1px solid var(--border, #e5e7eb)", fontSize: "0.8rem" }}
          >
            <option value="1">Last 1 hour</option>
            <option value="6">Last 6 hours</option>
            <option value="24">Last 24 hours</option>
            <option value="168">Last 7 days</option>
            <option value="720">Last 30 days</option>
          </select>
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 4, flex: "1 1 200px" }}>
          <span style={{ fontSize: "0.7rem", fontWeight: 600 }}>Endpoint</span>
          <input
            placeholder="např. /api/v1/properties"
            value={filterEndpoint}
            onChange={(e) => setFilterEndpoint(e.target.value)}
            style={{ padding: "0.4rem", borderRadius: 4, border: "1px solid var(--border, #e5e7eb)", fontSize: "0.8rem", fontFamily: "monospace" }}
          />
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span style={{ fontSize: "0.7rem", fontWeight: 600 }}>Status</span>
          <input
            placeholder="200"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            style={{ padding: "0.4rem", borderRadius: 4, border: "1px solid var(--border, #e5e7eb)", fontSize: "0.8rem", width: 80 }}
          />
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 4, flex: "1 1 220px" }}>
          <span style={{ fontSize: "0.7rem", fontWeight: 600 }}>API key id</span>
          <input
            placeholder="UUID"
            value={filterApiKeyId}
            onChange={(e) => setFilterApiKeyId(e.target.value)}
            style={{ padding: "0.4rem", borderRadius: 4, border: "1px solid var(--border, #e5e7eb)", fontSize: "0.8rem", fontFamily: "monospace" }}
          />
        </label>
        <button
          onClick={load}
          style={{
            padding: "0.5rem 1rem",
            background: "#111827",
            color: "white",
            border: "none",
            borderRadius: 4,
            fontWeight: 600,
            cursor: "pointer",
            fontSize: "0.8rem",
          }}
        >
          Refresh
        </button>
      </div>

      {/* Table */}
      <div style={{ border: "1px solid var(--border, #e5e7eb)", borderRadius: 8, overflow: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.75rem" }}>
          <thead style={{ background: "var(--bg-muted, #f9fafb)", position: "sticky", top: 0 }}>
            <tr>
              <th style={thStyle}>Time</th>
              <th style={thStyle}>Method</th>
              <th style={thStyle}>Endpoint</th>
              <th style={thStyle}>Status</th>
              <th style={thStyle}>Latency</th>
              <th style={thStyle}>Caller</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={6} style={{ padding: "2rem", textAlign: "center", color: "var(--text-muted, #6b7280)" }}>
                  Načítání…
                </td>
              </tr>
            )}
            {!loading && data && data.data.length === 0 && (
              <tr>
                <td colSpan={6} style={{ padding: "2rem", textAlign: "center", color: "var(--text-muted, #6b7280)" }}>
                  Žádné requesty v tomto okně.
                </td>
              </tr>
            )}
            {!loading &&
              data?.data.map((row) => (
                <tr key={row.id} style={{ borderTop: "1px solid var(--border, #e5e7eb)" }}>
                  <td style={tdStyle}>{fmtDateTime(row.created_at)}</td>
                  <td style={{ ...tdStyle, fontFamily: "monospace" }}>{row.method}</td>
                  <td style={{ ...tdStyle, fontFamily: "monospace" }}>{row.endpoint}</td>
                  <td style={{ ...tdStyle, fontWeight: 600, color: statusColor(row.status) }}>{row.status}</td>
                  <td style={tdStyle}>{row.latency_ms} ms</td>
                  <td style={{ ...tdStyle, fontFamily: "monospace", fontSize: "0.7rem" }}>
                    {row.api_key_id
                      ? `key:${row.api_key_id.slice(0, 8)}…`
                      : row.client_hash
                        ? `anon:${row.client_hash.slice(0, 8)}…`
                        : "—"}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function KpiCard({ label, value, color }: { label: string; value: string; color?: string }) {
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
      <div style={{ fontSize: "1.5rem", fontWeight: 700, color: color || undefined }}>{value}</div>
    </div>
  );
}

const thStyle: React.CSSProperties = {
  textAlign: "left",
  padding: "0.6rem",
  fontSize: "0.7rem",
  fontWeight: 600,
  textTransform: "uppercase",
  letterSpacing: "0.03em",
  color: "var(--text-muted, #6b7280)",
};

const tdStyle: React.CSSProperties = {
  padding: "0.6rem",
  verticalAlign: "middle",
};
