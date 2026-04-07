import { GET as origGet } from "@/app/api/valuation/status/route";
import { v1Proxy } from "@/lib/api/v1-proxy";

export const dynamic = "force-dynamic";
export const GET = v1Proxy(origGet);
