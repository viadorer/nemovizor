"use client";

import { useEffect } from "react";
import { useAuth } from "@/components/auth-provider";
import { getBrowserSupabase } from "@/lib/supabase-browser";

export function TrackView({ propertyId }: { propertyId: string }) {
  const { user } = useAuth();

  useEffect(() => {
    if (!user || !propertyId) return;
    const supabase = getBrowserSupabase();
    if (!supabase) return;

    supabase
      .from("recently_viewed")
      .upsert(
        { user_id: user.id, property_id: propertyId, viewed_at: new Date().toISOString() },
        { onConflict: "user_id,property_id" }
      )
      .then(() => {});
  }, [user, propertyId]);

  return null;
}
