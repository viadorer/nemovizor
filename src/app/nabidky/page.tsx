"use client";

import { Suspense } from "react";
import { SiteHeader } from "@/components/site-header";
import { ListingsContent } from "@/components/listings-content";

export default function ListingsPage() {
  return (
    <Suspense fallback={<div className="page-shell"><SiteHeader /><main className="search-page" /></div>}>
      <ListingsContent />
    </Suspense>
  );
}
