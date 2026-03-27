"use client";

import { useEffect, Suspense } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { track, captureUtm, setAnalyticsUser } from "@/lib/analytics";

// Inner component uses useSearchParams (must be wrapped in Suspense)
function AnalyticsInner() {
  const { user } = useAuth();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Sync user ID into analytics module whenever auth state changes
  useEffect(() => {
    setAnalyticsUser(user?.id ?? null);
  }, [user?.id]);

  // Capture UTM params on first load
  useEffect(() => {
    captureUtm();
  }, []);

  // Track page_view on every route change
  useEffect(() => {
    const utm_source = searchParams.get("utm_source") ?? undefined;
    const utm_medium = searchParams.get("utm_medium") ?? undefined;
    const utm_campaign = searchParams.get("utm_campaign") ?? undefined;

    track("page_view", {
      path: pathname,
      utm_source,
      utm_medium,
      utm_campaign,
    });
  }, [pathname, searchParams]);

  return null;
}

export function AnalyticsProvider({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Suspense fallback={null}>
        <AnalyticsInner />
      </Suspense>
      {children}
    </>
  );
}
