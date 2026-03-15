import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin, supabaseServer } from "@/lib/supabase";
import type { Database } from "@/lib/supabase-types";

type LeadInsert = Database["public"]["Tables"]["leads"]["Insert"];

function getClient() {
  return supabaseAdmin ?? supabaseServer;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const sb = getClient();
    if (!sb) return NextResponse.json({ error: "DB not available" }, { status: 500 });

    const lead: LeadInsert = {
      name: body.name || "",
      email: body.email || "",
      phone: body.phone || "",
      property_type: body.propertyType || "",
      intent: body.intent || "",
      address: body.address || "",
      note: body.note || "",
      source: body.source || "prodat-page",
      created_at: new Date().toISOString(),
    };

    const { error } = await sb.from("leads").insert(lead as never);

    if (error) {
      console.error("Lead insert error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("Lead API error:", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
