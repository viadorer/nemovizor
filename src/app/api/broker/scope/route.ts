/**
 * GET /api/broker/scope — returns the caller's primary owner identity.
 *
 * Broker dashboard forms call this on mount so they can prefill the
 * owner_type/owner_id fields when creating API keys or webhooks. Having
 * it as a dedicated endpoint keeps authz logic on the server and lets
 * the UI treat the scope as opaque.
 */
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-utils";
import { apiError } from "@/lib/api/response";
import { primaryOwner, resolveBrokerScope } from "@/lib/api/broker-scope";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireAuth(["broker", "admin"]);
  if (!auth) return apiError("UNAUTHORIZED", "Broker or admin authentication required", 401);

  const scope = await resolveBrokerScope(auth.supabase, auth.user.id);
  const primary = primaryOwner(scope);

  return NextResponse.json({
    data: {
      primary_owner_type: primary?.ownerType ?? null,
      primary_owner_id: primary?.ownerId ?? null,
      broker_ids: scope.brokerIds,
      agency_id: scope.agencyId,
      own_broker_id: scope.ownBrokerId,
    },
  });
}
