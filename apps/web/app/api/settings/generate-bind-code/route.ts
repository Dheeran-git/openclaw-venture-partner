import { NextResponse } from "next/server";
import { getSession } from "../../../../lib/supabaseServer";
import { createServiceRoleClient } from "@openclaw/db";

function generateCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({})) as { platform?: string };
  const { platform = "telegram" } = body;

  if (!["telegram", "discord", "slack"].includes(platform)) {
    return NextResponse.json({ error: "invalid_platform" }, { status: 400 });
  }

  const supabase = createServiceRoleClient();
  const code = generateCode();
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

  const { error } = await supabase.from("binding_codes").insert({
    code,
    user_id: session.user.id,
    platform: platform as "telegram" | "discord" | "slack" | "whatsapp",
    expires_at: expiresAt,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ code, expires_at: expiresAt });
}
