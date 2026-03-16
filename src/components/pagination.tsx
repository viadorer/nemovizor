"use client";

type PaginationProps = {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
};

export function Pagination({ page, totalPages, onPageChange }: PaginationProps) {
  if (totalPages <= 1) return null;

  // Build page numbers to show: first, last, and +-2 around current
  const pages: (number | "...")[] = [];
  const addPage = (p: number) => {
    if (p >= 1 && p <= totalPages && !pages.includes(p)) pages.push(p);
  };

  addPage(1);
  if (page - 2 > 2) pages.push("...");
  for (let i = page - 2; i <= page + 2; i++) addPage(i);
  if (page + 2 < totalPages - 1) pages.push("...");
  addPage(totalPages);

  return (
    <div className="pagination">
      <button
        className="pagination-btn"
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M15 18l-6-6 6-6" />
        </svg>
      </button>

      {pages.map((p, i) =>
        p === "..." ? (
          <span key={`dots-${i}`} className="pagination-dots">...</span>
        ) : (
          <button
            key={p}
            className={`pagination-btn ${p === page ? "pagination-btn--active" : ""}`}
            onClick={() => onPageChange(p)}
          >
            {p}
          </button>
        )
      )}

      <button
        className="pagination-btn"
        disabled={page >= totalPages}
        onClick={() => onPageChange(page + 1)}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M9 18l6-6-6-6" />
        </svg>
      </button>
    </div>
  );
}
