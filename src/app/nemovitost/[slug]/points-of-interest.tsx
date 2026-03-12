import type { PointOfInterest, PointOfInterestCategory } from "@/lib/types";

const categoryMeta: Record<
  PointOfInterestCategory,
  { label: string; icon: string }
> = {
  school: {
    label: "Školy",
    icon: "M12 14l9-5-9-5-9 5 9 5zM12 14l6.16-3.422A12.08 12.08 0 0119 14.5c0 2.485-3.134 4.5-7 4.5s-7-2.015-7-4.5c0-1.247.553-2.396 1.484-3.305",
  },
  transport: {
    label: "Doprava",
    icon: "M8 6v6m7-6v6M2 12h20M6 18h12a2 2 0 002-2V8a2 2 0 00-2-2H6a2 2 0 00-2 2v8a2 2 0 002 2zm1 0v2m10-2v2",
  },
  shop: {
    label: "Obchody",
    icon: "M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z",
  },
  restaurant: {
    label: "Restaurace",
    icon: "M18 8h1a4 4 0 010 8h-1M2 8h16v9a4 4 0 01-4 4H6a4 4 0 01-4-4V8zm6-5v3m4-3v3",
  },
  park: {
    label: "Parky a příroda",
    icon: "M12 22V8M5 12H2l10-10 10 10h-3M7 21h10",
  },
  health: {
    label: "Zdravotnictví",
    icon: "M12 4v16m-8-8h16",
  },
  sport: {
    label: "Sport",
    icon: "M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664zM21 12a9 9 0 11-18 0 9 9 0 0118 0z",
  },
  culture: {
    label: "Kultura",
    icon: "M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z",
  },
};

function formatDistance(meters: number): string {
  if (meters >= 1000) {
    return `${(meters / 1000).toFixed(1)} km`;
  }
  return `${meters} m`;
}

export function PointsOfInterest({
  items,
}: {
  items: PointOfInterest[];
}) {
  if (!items.length) return null;

  // Group by category
  const grouped = new Map<PointOfInterestCategory, PointOfInterest[]>();
  for (const item of items) {
    const arr = grouped.get(item.category) ?? [];
    arr.push(item);
    grouped.set(item.category, arr);
  }

  return (
    <div className="detail-section">
      <h2 className="detail-section-title">
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
          <circle cx="12" cy="10" r="3" />
        </svg>
        Body zájmu v okolí
      </h2>
      <div className="poi-grid">
        {Array.from(grouped.entries()).map(([category, pois]) => {
          const meta = categoryMeta[category];
          return (
            <div key={category} className="poi-category">
              <div className="poi-category-header">
                <svg
                  className="poi-icon"
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d={meta.icon} />
                </svg>
                <span className="poi-category-label">{meta.label}</span>
              </div>
              <div className="poi-items">
                {pois
                  .sort((a, b) => a.distance - b.distance)
                  .map((poi, i) => (
                    <div key={i} className="poi-item">
                      <span className="poi-name">{poi.name}</span>
                      <span className="poi-distance">
                        {formatDistance(poi.distance)}
                        {poi.walkMinutes != null && (
                          <span className="poi-walk">
                            {" "}
                            ~ {poi.walkMinutes} min
                          </span>
                        )}
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
