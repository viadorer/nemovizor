import { GET as origGet } from "@/app/api/filter-options/route";
import { v1Proxy } from "@/lib/api/v1-proxy";

export const dynamic = "force-dynamic";
export const GET = v1Proxy(origGet);
