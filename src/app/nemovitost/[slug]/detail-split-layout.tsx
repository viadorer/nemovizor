"use client";

import { type ReactNode, useRef } from "react";
import { WideDetailMap } from "./detail-map";
import type { Property } from "@/lib/types";

export function DetailSplitLayout({
  children,
  properties,
  selectedPropertyId,
}: {
  children: ReactNode;
  properties: Property[];
  selectedPropertyId: string;
}) {
  const layoutRef = useRef<HTMLDivElement>(null);

  return (
    <div className="detail-split-layout" ref={layoutRef}>
      <div className="detail-split-sidebar">
        {children}
      </div>

      <div
        className="detail-split-handle"
        onMouseDown={(e) => {
          e.preventDefault();
          const layout = layoutRef.current!;
          const startX = e.clientX;
          const sidebar = layout.querySelector(".detail-split-sidebar") as HTMLElement;
          const startWidth = sidebar.offsetWidth;
          const layoutWidth = layout.offsetWidth;
          function onMove(ev: MouseEvent) {
            const dx = ev.clientX - startX;
            // Content min 60%, max 90% — never cut off data
            const newPct = Math.min(90, Math.max(60, ((startWidth + dx) / layoutWidth) * 100));
            sidebar.style.width = `${newPct}%`;
            const mapPanel = layout.querySelector(".detail-split-map") as HTMLElement;
            if (mapPanel) mapPanel.style.width = `${100 - newPct}%`;
            window.dispatchEvent(new Event("resize"));
          }
          function onUp() {
            document.removeEventListener("mousemove", onMove);
            document.removeEventListener("mouseup", onUp);
            document.body.style.cursor = "";
            document.body.style.userSelect = "";
          }
          document.body.style.cursor = "col-resize";
          document.body.style.userSelect = "none";
          document.addEventListener("mousemove", onMove);
          document.addEventListener("mouseup", onUp);
        }}
      >
        <div className="search-resize-grip" />
      </div>

      <div className="detail-split-map">
        <WideDetailMap
          properties={properties}
          selectedPropertyId={selectedPropertyId}
        />
      </div>
    </div>
  );
}
