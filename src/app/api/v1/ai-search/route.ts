import { POST as origPost } from "@/app/api/ai-search/route";
import { v1Proxy } from "@/lib/api/v1-proxy";

export const dynamic = "force-dynamic";
export const POST = v1Proxy(origPost);
