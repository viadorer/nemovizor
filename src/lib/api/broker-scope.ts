/**
 * Broker / agency scope helpers shared by /api/broker/* endpoints.
 *
 * Every broker self-service endpoint must resolve *which* broker (or
 * agency) is making the request, and scope all reads/writes to owned
 * resources only. This module centralises that logic so we don't repeat
 * the `brokers.user_id` lookup + agency team expansion in each handler.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export interface BrokerScope {
  /** Broker ids the caller may manage (own id, or all brokers in their agency). */
  brokerIds: string[];
  /** Agency id if the caller owns an agency, otherwise null. */
  agencyId: string | null;
  /** The caller's own broker id, if any. */
  ownBrokerId: string | null;
}

/**
 * Resolve the caller's broker scope.
 *
 * - If the user is a broker → owns at least their own broker record
 * - If the user owns an agency → can manage all brokers in that agency
 * - A solo user with no broker row gets an empty scope (caller should 403)
 */
export async function resolveBrokerScope(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  userId: string,
): Promise<BrokerScope> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;

  const { data: myBroker } = await sb
    .from("brokers")
    .select("id, agency_id")
    .eq("user_id", userId)
    .maybeSingle();

  const { data: myAgency } = await sb
    .from("agencies")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();

  const agencyId: string | null = myAgency?.id ?? myBroker?.agency_id ?? null;

  if (agencyId) {
    const { data: teamBrokers } = await sb
      .from("brokers")
      .select("id")
      .eq("agency_id", agencyId);
    return {
      brokerIds: (teamBrokers ?? []).map((b: { id: string }) => b.id),
      agencyId,
      ownBrokerId: myBroker?.id ?? null,
    };
  }

  return {
    brokerIds: myBroker ? [myBroker.id] : [],
    agencyId: null,
    ownBrokerId: myBroker?.id ?? null,
  };
}

/**
 * Determine the owner identity a broker self-service create operation
 * should use.
 *
 *  - Agency owner → `{ ownerType: "agency", ownerId: agencyId }`
 *  - Solo broker → `{ ownerType: "broker", ownerId: ownBrokerId }`
 *  - Nothing matches → `null` (caller must 403)
 */
export function primaryOwner(
  scope: BrokerScope,
): { ownerType: "broker" | "agency"; ownerId: string } | null {
  if (scope.agencyId) return { ownerType: "agency", ownerId: scope.agencyId };
  if (scope.ownBrokerId) return { ownerType: "broker", ownerId: scope.ownBrokerId };
  return null;
}
