"use client";

import { useRouter } from "next/navigation";

export function BackButton({ label }: { label: string }) {
  const router = useRouter();

  return (
    <button
      onClick={() => {
        // If we came from /nabidky, go back to preserve scroll + filters
        if (typeof window !== "undefined" && document.referrer.includes("/nabidky")) {
          router.back();
        } else {
          // Fallback — navigate to listings
          router.push("/nabidky");
        }
      }}
      className="detail-back"
      style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M19 12H5M12 19l-7-7 7-7" />
      </svg>
      {label}
    </button>
  );
}
