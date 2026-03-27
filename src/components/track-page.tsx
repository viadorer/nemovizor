"use client";

import { useEffect, useRef } from "react";
import { track } from "@/lib/analytics";

/**
 * TrackPage — drop into any server component to fire a custom page-level event once.
 * Example: <TrackPage event="broker_profile_view" props={{ broker_id: "abc" }} />
 */
export function TrackPage({
  event,
  props,
}: {
  event: string;
  props?: Record<string, string | number | boolean | null | undefined>;
}) {
  const fired = useRef(false);
  useEffect(() => {
    if (fired.current) return;
    fired.current = true;
    track(event, props);
  }, [event, props]);

  return null;
}
