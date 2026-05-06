import { handlers } from "@openclaw/agent/mcp-tools";
import { createServiceRoleClient } from "@openclaw/db";
import { createPublicKey, verify as cryptoVerify } from "node:crypto";

/**
 * Discord interactions webhook.
 * Discord POSTs all slash-command + button + modal interactions to a single
 * URL. We verify the Ed25519 signature against DISCORD_PUBLIC_KEY, then:
 *
 *   type 1 (PING)    → respond { type: 1 }
 *   type 2 (COMMAND) → handle /scout, /pitches, /clients, /help
 *   type 3 (BUTTON)  → resolve `act:<token>` → call approvePitch/rejectPitch
 *
 * Per build guide §7.2.
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface DiscordInteraction {
  type: number;
  id: string;
  application_id: string;
  token: string;
  member?: { user: { id: string; username?: string } };
  user?: { id: string; username?: string };
  data?: {
    name?: string;
    custom_id?: string;
    options?: Array<{ name: string; value: unknown }>;
  };
  channel_id?: string;
}

const INTERACTION_PING = 1;
const INTERACTION_APPLICATION_COMMAND = 2;
const INTERACTION_MESSAGE_COMPONENT = 3;
// const INTERACTION_RESPONSE_PONG = 1;
const INTERACTION_RESPONSE_CHANNEL_MESSAGE = 4;
const INTERACTION_RESPONSE_UPDATE_MESSAGE = 7;

function publicKeyToPem(hex: string): string {
  // Convert raw 32-byte Ed25519 public key (hex) to a SubjectPublicKeyInfo
  // DER encoding wrapped in PEM. Prefix bytes are the DER header for
  // {AlgorithmIdentifier: id-Ed25519, BIT STRING: <key>}.
  const prefix = Buffer.from("302a300506032b6570032100", "hex");
  const der = Buffer.concat([prefix, Buffer.from(hex, "hex")]);
  const b64 = der.toString("base64").match(/.{1,64}/g)?.join("\n") ?? "";
  return `-----BEGIN PUBLIC KEY-----\n${b64}\n-----END PUBLIC KEY-----\n`;
}

function verifySignature(
  rawBody: string,
  signature: string,
  timestamp: string
): boolean {
  const publicKeyHex = process.env.DISCORD_PUBLIC_KEY;
  if (!publicKeyHex || !signature || !timestamp) return false;
  try {
    const key = createPublicKey({
      key: publicKeyToPem(publicKeyHex),
      format: "pem",
    });
    const message = Buffer.from(timestamp + rawBody);
    const sig = Buffer.from(signature, "hex");
    return cryptoVerify(null, message, key, sig);
  } catch {
    return false;
  }
}

function userId(i: DiscordInteraction): string | undefined {
  return i.member?.user?.id ?? i.user?.id;
}

async function handleSlashCommand(
  i: DiscordInteraction
): Promise<Response> {
  const cmd = i.data?.name;
  const dUserId = userId(i);
  if (!dUserId) return ephemeralReply("Could not identify user.");

  // /bind is the only command available before the user is linked.
  if (cmd === "bind") {
    const code = (i.data?.options?.find((o) => o.name === "code")?.value ??
      "") as string;
    if (!code) return ephemeralReply("Usage: /bind code:<6-digit-code>");
    const result = (await handlers.bindDiscord!({
      code,
      discord_user_id: dUserId,
    })) as { ok: boolean; error?: string };
    return ephemeralReply(
      result.ok
        ? "✅ Discord linked! You can now use /scout, /pitches, /clients, /help."
        : `Linking failed: ${result.error ?? "unknown"}`
    );
  }

  // Resolve the operator's profile from discord_user_id.
  const supabase = createServiceRoleClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, display_name")
    .eq("discord_user_id", dUserId)
    .maybeSingle();

  if (!profile) {
    return ephemeralReply(
      "Your Discord isn't linked yet. Open the dashboard at /settings/connect, generate a 6-digit code, then run `/bind code:<the-code>` here."
    );
  }

  if (cmd === "scout") {
    const query = (i.data?.options?.find((o) => o.name === "query")?.value ??
      "") as string;
    if (!query) return ephemeralReply("Usage: /scout query:<text>");
    const result = (await handlers.runScout!({
      user_id: profile.id,
      platform: "discord",
      platform_user_id: dUserId,
      query,
    })) as { ok: boolean; error?: string };
    return ephemeralReply(
      result.ok
        ? `Scouting "${query}". I'll DM you when leads land.`
        : `Scout failed: ${result.error}`
    );
  }
  if (cmd === "pitches") {
    const result = (await handlers.getPendingPitches!({
      user_id: profile.id,
    })) as { ok: boolean; pitches?: Array<{ subject: string }>; error?: string };
    if (!result.ok) return ephemeralReply(`Error: ${result.error}`);
    const list = result.pitches ?? [];
    if (list.length === 0) return ephemeralReply("No pending pitches.");
    return ephemeralReply(
      `**Pending pitches (${list.length}):**\n` +
        list.map((p, i) => `${i + 1}. ${p.subject}`).join("\n")
    );
  }
  if (cmd === "clients") {
    return ephemeralReply(
      "Open the dashboard at /clients to view your active client memory."
    );
  }
  if (cmd === "help") {
    return ephemeralReply(
      "**OpenClaw Venture Partner**\n" +
        "/bind code:<6-digit> — link your Discord (run once)\n" +
        "/scout query:<text> — find new leads\n" +
        "/pitches — show pending pitch approvals\n" +
        "/clients — open the client list in the dashboard\n" +
        "/help — show this list\n\n" +
        "Approvals: when I find a lead and draft a pitch, you get a DM with ✅ Approve and ❌ Reject buttons."
    );
  }
  return ephemeralReply(`Unknown command: ${cmd ?? "(none)"}`);
}

async function handleComponent(
  i: DiscordInteraction
): Promise<Response> {
  const customId = i.data?.custom_id ?? "";
  if (!customId.startsWith("act:")) return ephemeralReply("Unknown action.");
  const token = customId.slice(4);

  const supabase = createServiceRoleClient();
  const { data: cbToken, error } = await supabase
    .from("chat_callback_tokens")
    .select("user_id, pitch_id, payload_hash, action, expires_at, used_at")
    .eq("token", token)
    .single();

  if (error || !cbToken) return ephemeralReply("This action link is invalid.");
  if (cbToken.used_at)
    return ephemeralReply("This action has already been completed.");
  if (new Date(cbToken.expires_at) < new Date())
    return ephemeralReply("This action link expired. Use the dashboard.");

  let result: { ok: boolean; error?: string };
  if (cbToken.action === "approve") {
    result = (await handlers.approvePitch!({
      user_id: cbToken.user_id,
      pitch_id: cbToken.pitch_id,
      payload_hash: cbToken.payload_hash,
      actor_platform: "discord",
    })) as { ok: boolean; error?: string };
  } else if (cbToken.action === "reject") {
    result = (await handlers.rejectPitch!({
      user_id: cbToken.user_id,
      pitch_id: cbToken.pitch_id,
      actor_platform: "discord",
    })) as { ok: boolean; error?: string };
  } else {
    return ephemeralReply("Unknown action type.");
  }

  if (!result.ok) {
    return ephemeralReply(`Error: ${result.error ?? "unknown"}`);
  }

  await supabase
    .from("chat_callback_tokens")
    .update({ used_at: new Date().toISOString() })
    .eq("token", token);

  // Update the original message in place so the buttons can't be re-clicked.
  return Response.json({
    type: INTERACTION_RESPONSE_UPDATE_MESSAGE,
    data: {
      content:
        cbToken.action === "approve"
          ? "✅ Pitch approved. Sending now…"
          : "❌ Pitch rejected.",
      embeds: [],
      components: [],
    },
  });
}

function ephemeralReply(content: string): Response {
  return Response.json({
    type: INTERACTION_RESPONSE_CHANNEL_MESSAGE,
    data: { content, flags: 64 }, // 64 = ephemeral (only the user sees it)
  });
}

export async function POST(req: Request) {
  const sig = req.headers.get("x-signature-ed25519") ?? "";
  const ts = req.headers.get("x-signature-timestamp") ?? "";
  const raw = await req.text();

  if (!verifySignature(raw, sig, ts)) {
    return new Response("invalid request signature", { status: 401 });
  }

  let body: DiscordInteraction;
  try {
    body = JSON.parse(raw) as DiscordInteraction;
  } catch {
    return new Response("Bad Request", { status: 400 });
  }

  if (body.type === INTERACTION_PING) {
    return Response.json({ type: 1 });
  }
  if (body.type === INTERACTION_APPLICATION_COMMAND) {
    return handleSlashCommand(body);
  }
  if (body.type === INTERACTION_MESSAGE_COMPONENT) {
    return handleComponent(body);
  }
  return ephemeralReply("Unsupported interaction type.");
}
