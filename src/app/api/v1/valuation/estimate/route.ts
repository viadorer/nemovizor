import { POST as origPost } from "@/app/api/valuation/estimate/route";
import { v1Proxy } from "@/lib/api/v1-proxy";

export const dynamic = "force-dynamic";
export const POST = v1Proxy(origPost);
