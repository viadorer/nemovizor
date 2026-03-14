"use client";

import { useState, useEffect, useCallback, type ReactNode } from "react";

export type Column<T> = {
  key: string;
  label: string;
  render?: (row: T) => ReactNode;
  sortable?: boolean;
};

type DataTableProps<T> = {
  title: string;
  columns: Column<T>[];
  fetchData: (params: {
    page: number;
    limit: number;
    search: string;
    sort: string;
    order: "asc" | "desc";
  }) => Promise<{ data: T[]; total: number }>;
  rowKey: (row: T) => string;
  actions?: ReactNode;
  onRowClick?: (row: T) => void;
  rowActions?: (row: T) => ReactNode;
  searchPlaceholder?: string;
  pageSize?: number;
};

export function DataTable<T>({
  title,
  columns,
  fetchData,
  rowKey,
  actions,
  onRowClick,
  rowActions,
  searchPlaceholder = "Hledat...",
  pageSize = 20,
}: DataTableProps<T>) {
  const [data, setData] = useState<T[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("");
  const [order, setOrder] = useState<"asc" | "desc">("desc");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await fetchData({ page, limit: pageSize, search, sort, order });
      setData(result.data);
      setTotal(result.total);
    } catch {
      setData([]);
      setTotal(0);
    }
    setLoading(false);
  }, [fetchData, page, pageSize, search, sort, order]);

  useEffect(() => {
    load();
  }, [load]);

  // Debounce search
  useEffect(() => {
    setPage(1);
  }, [search]);

  const totalPages = Math.ceil(total / pageSize);

  function handleSort(key: string) {
    if (sort === key) {
      setOrder(order === "asc" ? "desc" : "asc");
    } else {
      setSort(key);
      setOrder("asc");
    }
  }

  return (
    <div className="admin-table-wrap">
      <div className="admin-table-header">
        <h2>{title}</h2>
        <input
          type="text"
          className="admin-table-search"
          placeholder={searchPlaceholder}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {actions && <div className="admin-table-actions">{actions}</div>}
      </div>

      <div style={{ overflow: "auto" }}>
        <table className="admin-table">
          <thead>
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  onClick={col.sortable !== false ? () => handleSort(col.key) : undefined}
                  style={col.sortable === false ? { cursor: "default" } : undefined}
                >
                  {col.label}
                  {sort === col.key && (order === "asc" ? " ↑" : " ↓")}
                </th>
              ))}
              {rowActions && <th style={{ width: 100 }}>Akce</th>}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={columns.length + (rowActions ? 1 : 0)} style={{ textAlign: "center", padding: 40, color: "var(--text-muted)" }}>
                  Načítání...
                </td>
              </tr>
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={columns.length + (rowActions ? 1 : 0)} style={{ textAlign: "center", padding: 40, color: "var(--text-muted)" }}>
                  Žádné záznamy
                </td>
              </tr>
            ) : (
              data.map((row) => (
                <tr
                  key={rowKey(row)}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  style={onRowClick ? { cursor: "pointer" } : undefined}
                >
                  {columns.map((col) => (
                    <td key={col.key}>
                      {col.render
                        ? col.render(row)
                        : String((row as Record<string, unknown>)[col.key] ?? "")}
                    </td>
                  ))}
                  {rowActions && (
                    <td onClick={(e) => e.stopPropagation()}>
                      {rowActions(row)}
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="admin-table-footer">
        <span>
          {total} záznamů
          {totalPages > 1 && ` | Strana ${page} z ${totalPages}`}
        </span>
        {totalPages > 1 && (
          <div className="admin-table-pagination">
            <button
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page <= 1}
            >
              ←
            </button>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              const p = page <= 3 ? i + 1 : page + i - 2;
              if (p < 1 || p > totalPages) return null;
              return (
                <button
                  key={p}
                  className={p === page ? "active" : ""}
                  onClick={() => setPage(p)}
                >
                  {p}
                </button>
              );
            })}
            <button
              onClick={() => setPage(Math.min(totalPages, page + 1))}
              disabled={page >= totalPages}
            >
              →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export function refreshTable() {
  // Force re-render by incrementing a key - handled by parent
}
