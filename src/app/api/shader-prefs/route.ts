import { NextResponse } from "next/server";
import { writeFileSync, readFileSync } from "fs";
import { createClient } from "@/lib/supabase/server";

const SYNC_PATH = "/tmp/shader-prefs.json";

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized", status: 401 as const };
  const adminEmail = process.env.ADMIN_EMAIL?.toLowerCase().trim();
  if (!adminEmail || user.email?.toLowerCase().trim() !== adminEmail) {
    return { error: "Forbidden", status: 403 as const };
  }
  return { user };
}

export async function POST(req: Request) {
  const gate = await requireAdmin();
  if ("error" in gate) return NextResponse.json({ error: gate.error }, { status: gate.status });

  const data = await req.json();
  writeFileSync(SYNC_PATH, JSON.stringify(data, null, 2));
  return NextResponse.json({ ok: true });
}

export async function GET() {
  const gate = await requireAdmin();
  if ("error" in gate) return NextResponse.json({ error: gate.error }, { status: gate.status });

  try {
    const raw = readFileSync(SYNC_PATH, "utf-8");
    return NextResponse.json(JSON.parse(raw));
  } catch {
    return NextResponse.json({ blocked: [], loved: [], deleted: [] });
  }
}
