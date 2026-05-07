import { createServiceRoleClient } from "@openclaw/db";
import { Inngest } from "inngest";
import { randomUUID } from "node:crypto";
import { computePayloadHash } from "../drafting";

const inngest = new Inngest({
  id: "openclaw",
  eventKey: process.env.INNGEST_EVENT_KEY,
});

type Args = Record<string, unknown>;
type ToolResult = Record<string, unknown>;

// ---------------------------------------------------------------------------
// Helper: resolve profiles.id from a platform binding
// ---------------------------------------------------------------------------
async function resolveUser(
  platform: string,
  platformUserId: string
): Promise<string | null> {
  const supabase = createServiceRoleClient();
  const column =
    platform === "telegram"
      ? "telegram_user_id"
      : platform === "discord"
      ? "discord_user_id"
      : "slack_user_id";

  const { data } = await supabase
    .from("profiles")
    .select("id")
    .eq(column, platform === "telegram" ? Number(platformUserId) : platformUserId)
    .single();

  return data?.id ?? null;
}

// ---------------------------------------------------------------------------
// Telegram Bot API helpers
// ---------------------------------------------------------------------------
function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

async function sendTelegramMessage(
  chatId: number | string,
  text: string,
  inlineKeyboard?: Array<Array<{ text: string; callback_data: string }>>
): Promise<{ ok: boolean; message_id?: number }> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return { ok: false };
  const body: Record<string, unknown> = {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
  };
  if (inlineKeyboard) {
    body.reply_markup = { inline_keyboard: inlineKeyboard };
  }
  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    result?: { message_id?: number };
  };
  return { ok: json.ok ?? false, message_id: json.result?.message_id };
}

// ---------------------------------------------------------------------------
// Discord Bot API helpers
// ---------------------------------------------------------------------------
const DISCORD_API = "https://discord.com/api/v10";
const DISCORD_BRAND_COLOR = 0xff4d4d; // Coral, per build guide §7.2

async function discordOpenDm(userId: string): Promise<string | null> {
  const token = process.env.DISCORD_BOT_TOKEN;
  if (!token) return null;
  const res = await fetch(`${DISCORD_API}/users/@me/channels`, {
    method: "POST",
    headers: {
      Authorization: `Bot ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ recipient_id: userId }),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { id?: string };
  return data.id ?? null;
}

interface DiscordEmbed {
  title?: string;
  description?: string;
  color?: number;
  fields?: { name: string; value: string; inline?: boolean }[];
}

interface DiscordButton {
  type: 2; // BUTTON
  style: 1 | 2 | 3 | 4; // 3=Success, 4=Danger, 2=Secondary
  label: string;
  custom_id: string;
}

interface DiscordActionRow {
  type: 1; // ACTION_ROW
  components: DiscordButton[];
}

async function sendDiscordDmMessage(
  discordUserId: string,
  embed: DiscordEmbed,
  components?: DiscordActionRow[]
): Promise<{ ok: boolean; message_id?: string }> {
  const token = process.env.DISCORD_BOT_TOKEN;
  if (!token) return { ok: false };
  const channelId = await discordOpenDm(discordUserId);
  if (!channelId) return { ok: false };

  const body: Record<string, unknown> = { embeds: [embed] };
  if (components && components.length > 0) body.components = components;

  const res = await fetch(`${DISCORD_API}/channels/${channelId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bot ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) return { ok: false };
  const data = (await res.json().catch(() => ({}))) as { id?: string };
  return { ok: true, message_id: data.id };
}

// ---------------------------------------------------------------------------
// Phase 12 Stage A — Gateway-relay path for notifyAgent. Env-gated so the
// default (direct Telegram/Discord Bot API) behavior stays unchanged. Set
// OPENCLAW_GATEWAY_PRIMARY=true after the Gateway is up on its production
// host and you've verified the channel plugins handle outbound.
// On any Gateway error, we log and fall back to the direct path so HITL
// approvals never silently drop.
// ---------------------------------------------------------------------------
async function tryGatewayNotify(
  args: Args
): Promise<{ ok: true; via: "gateway"; data?: unknown } | { ok: false; error: string }> {
  const base = process.env.OPENCLAW_GATEWAY_URL?.trim();
  if (!base) return { ok: false, error: "no_gateway_url" };
  const path = process.env.OPENCLAW_GATEWAY_NOTIFY_PATH?.trim() || "/api/notify";
  const token = process.env.OPENCLAW_GATEWAY_TOKEN?.trim() ?? "";
  try {
    const res = await fetch(base.replace(/\/$/, "") + path, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(args),
      signal: AbortSignal.timeout(5_000),
    });
    if (!res.ok) return { ok: false, error: `gateway_status_${res.status}` };
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    return { ok: true, via: "gateway", data };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

// ---------------------------------------------------------------------------
// Lead-related tools
// ---------------------------------------------------------------------------

async function runScout(args: Args): Promise<ToolResult> {
  const { query, platform, platform_user_id, limit } = args as {
    query: string;
    platform: string;
    platform_user_id: string;
    limit?: number;
  };

  const userId = await resolveUser(platform, platform_user_id);
  if (!userId) return { ok: false, error: "platform_not_bound" };

  const { ids } = await inngest.send({
    name: "scout/requested",
    data: { user_id: userId, query, limit: limit ?? 10 },
  });

  return { ok: true, job_id: ids?.[0] ?? null };
}

async function getRecentLeads(args: Args): Promise<ToolResult> {
  const { platform, platform_user_id, limit = 5 } = args as {
    platform: string;
    platform_user_id: string;
    limit?: number;
  };

  const userId = await resolveUser(platform, platform_user_id);
  if (!userId) return { ok: false, error: "platform_not_bound" };

  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("leads")
    .select(
      `id, normalized, scraped_at,
       scores ( score, reasoning )`
    )
    .eq("user_id", userId)
    .order("scraped_at", { ascending: false })
    .limit(Number(limit));

  if (error) return { ok: false, error: error.message };

  const leads = (data ?? []).map((l) => {
    const norm = l.normalized as Record<string, unknown>;
    const score = Array.isArray(l.scores) ? (l.scores[0]?.score ?? null) : null;
    return {
      id: l.id,
      title: norm.title ?? "(untitled)",
      source: norm.source ?? "unknown",
      budget: norm.budget_text ?? null,
      score,
      scraped_at: l.scraped_at,
    };
  });

  return { ok: true, leads };
}

async function getTopLead(args: Args): Promise<ToolResult> {
  const { platform, platform_user_id } = args as {
    platform: string;
    platform_user_id: string;
  };

  const userId = await resolveUser(platform, platform_user_id);
  if (!userId) return { ok: false, error: "platform_not_bound" };

  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("scores")
    .select(
      `score, reasoning,
       leads!inner ( id, user_id, normalized, scraped_at )`
    )
    .eq("leads.user_id", userId)
    .order("score", { ascending: false })
    .limit(1)
    .single();

  if (error || !data) return { ok: false, error: "no_leads" };

  const lead = data.leads as unknown as Record<string, unknown>;
  const norm = (lead.normalized as Record<string, unknown>) ?? {};

  return {
    ok: true,
    lead: {
      id: lead.id,
      title: norm.title ?? "(untitled)",
      source: norm.source ?? "unknown",
      source_url: norm.source_url ?? null,
      budget: norm.budget_text ?? null,
      description: norm.description ?? null,
      score: data.score,
      reasoning: data.reasoning,
    },
  };
}

// ---------------------------------------------------------------------------
// Pitch tools — chat-surface equivalents of the web /api/pitches/[id]/* routes
// ---------------------------------------------------------------------------

async function getPendingPitches(args: Args): Promise<ToolResult> {
  const { platform, platform_user_id, limit = 10 } = args as {
    platform: string;
    platform_user_id: string;
    limit?: number;
  };

  const userId = await resolveUser(platform, platform_user_id);
  if (!userId) return { ok: false, error: "platform_not_bound" };

  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("pitches")
    .select("id, lead_id, subject, status, created_at, payload_hash")
    .eq("user_id", userId)
    .eq("status", "draft")
    .order("created_at", { ascending: false })
    .limit(Number(limit));

  if (error) return { ok: false, error: error.message };
  return { ok: true, pitches: data ?? [] };
}

async function approvePitch(args: Args): Promise<ToolResult> {
  const {
    user_id,
    pitch_id,
    payload_hash,
    actor_platform = "telegram",
  } = args as {
    user_id: string;
    pitch_id: string;
    payload_hash: string;
    actor_platform?: "telegram" | "discord" | "web";
  };

  if (!user_id || !pitch_id || !payload_hash) {
    return { ok: false, error: "missing_args" };
  }

  const supabase = createServiceRoleClient();

  const { data: pitch, error: pitchErr } = await supabase
    .from("pitches")
    .select("id, user_id, draft, subject, status")
    .eq("id", pitch_id)
    .single();

  if (pitchErr || !pitch) return { ok: false, error: "not_found" };
  if (pitch.user_id !== user_id) return { ok: false, error: "forbidden" };
  if (pitch.status !== "draft") return { ok: false, error: "not_draft" };

  const expected = computePayloadHash({
    id: pitch.id,
    subject: pitch.subject ?? "",
    draft: pitch.draft,
  });
  if (expected !== payload_hash) return { ok: false, error: "stale_draft" };

  const now = new Date().toISOString();

  const { error: approvalErr } = await supabase.from("approvals").insert({
    user_id,
    action_type: "pitch.send",
    resource_type: "pitches",
    resource_id: pitch.id,
    payload_hash,
    verified_payload_hash: expected,
    status: "approved",
    actor_platform,
    decided_at: now,
  });
  if (approvalErr) return { ok: false, error: approvalErr.message };

  await supabase
    .from("pitches")
    .update({ status: "approved", approved_at: now })
    .eq("id", pitch.id);

  await supabase.from("audit_log").insert({
    user_id,
    actor: "user",
    action: "pitch.approved",
    resource_type: "pitches",
    resource_id: pitch.id,
    metadata: { payload_hash, actor_platform },
  });

  await inngest.send({
    name: "pitch/approved",
    data: { pitch_id: pitch.id, user_id },
  });

  return { ok: true };
}

async function rejectPitch(args: Args): Promise<ToolResult> {
  const { user_id, pitch_id, actor_platform = "telegram" } = args as {
    user_id: string;
    pitch_id: string;
    actor_platform?: "telegram" | "discord" | "web";
  };

  if (!user_id || !pitch_id) return { ok: false, error: "missing_args" };

  const supabase = createServiceRoleClient();

  const { data: pitch, error: pitchErr } = await supabase
    .from("pitches")
    .select("id, user_id, status")
    .eq("id", pitch_id)
    .single();

  if (pitchErr || !pitch) return { ok: false, error: "not_found" };
  if (pitch.user_id !== user_id) return { ok: false, error: "forbidden" };
  if (pitch.status !== "draft") return { ok: false, error: "not_draft" };

  const now = new Date().toISOString();

  const { error: approvalErr } = await supabase.from("approvals").insert({
    user_id,
    action_type: "pitch.send",
    resource_type: "pitches",
    resource_id: pitch.id,
    payload_hash: "",
    verified_payload_hash: null,
    status: "rejected",
    actor_platform,
    decided_at: now,
  });
  if (approvalErr) return { ok: false, error: approvalErr.message };

  await supabase.from("pitches").update({ status: "rejected" }).eq("id", pitch.id);

  await supabase.from("audit_log").insert({
    user_id,
    actor: "user",
    action: "pitch.rejected",
    resource_type: "pitches",
    resource_id: pitch.id,
    metadata: { actor_platform },
  });

  return { ok: true };
}

async function editPitch(args: Args): Promise<ToolResult> {
  const {
    user_id,
    pitch_id,
    draft,
    subject,
    actor_platform = "telegram",
  } = args as {
    user_id: string;
    pitch_id: string;
    draft?: string;
    subject?: string;
    actor_platform?: "telegram" | "discord" | "web";
  };

  if (!user_id || !pitch_id) return { ok: false, error: "missing_args" };
  if (draft === undefined && subject === undefined) {
    return { ok: false, error: "nothing_to_edit" };
  }

  const supabase = createServiceRoleClient();

  const { data: pitch, error: pitchErr } = await supabase
    .from("pitches")
    .select("id, user_id, draft, subject, status")
    .eq("id", pitch_id)
    .single();

  if (pitchErr || !pitch) return { ok: false, error: "not_found" };
  if (pitch.user_id !== user_id) return { ok: false, error: "forbidden" };
  if (pitch.status !== "draft") return { ok: false, error: "not_draft" };

  const newSubject = subject ?? pitch.subject ?? "";
  const newDraft = draft ?? pitch.draft;
  const newHash = computePayloadHash({
    id: pitch.id,
    subject: newSubject,
    draft: newDraft,
  });

  const { error: updateErr } = await supabase
    .from("pitches")
    .update({ subject: newSubject, draft: newDraft, payload_hash: newHash })
    .eq("id", pitch.id);
  if (updateErr) return { ok: false, error: updateErr.message };

  await supabase.from("audit_log").insert({
    user_id,
    actor: "user",
    action: "pitch.edited",
    resource_type: "pitches",
    resource_id: pitch.id,
    metadata: { actor_platform },
  });

  return { ok: true, payload_hash: newHash };
}

// ---------------------------------------------------------------------------
// Bind tools
// ---------------------------------------------------------------------------

async function bindTelegram(args: Args): Promise<ToolResult> {
  const { code, telegram_user_id } = args as {
    code: string;
    telegram_user_id: string;
  };

  if (!code || !telegram_user_id) {
    return { ok: false, error: "missing_args" };
  }

  const supabase = createServiceRoleClient();
  const now = new Date().toISOString();

  // Codes are scoped to the user that generated them; the platform tag is
  // just a hint about intended use. Accept any unused, unexpired code so a
  // single dashboard "Generate code" button works for both Telegram and Discord.
  const { data: bindCode, error: lookupError } = await supabase
    .from("binding_codes")
    .select("*")
    .eq("code", code)
    .is("used_at", null)
    .gt("expires_at", now)
    .single();

  if (lookupError || !bindCode) {
    return { ok: false, error: "invalid_code" };
  }

  const { error: markError } = await supabase
    .from("binding_codes")
    .update({ used_at: now })
    .eq("code", code);

  if (markError) return { ok: false, error: markError.message };

  const { error: profileError } = await supabase
    .from("profiles")
    .update({ telegram_user_id: Number(telegram_user_id) })
    .eq("id", bindCode.user_id);

  if (profileError) return { ok: false, error: profileError.message };

  return { ok: true, user_id: bindCode.user_id };
}

async function bindDiscord(args: Args): Promise<ToolResult> {
  const { code, discord_user_id } = args as {
    code: string;
    discord_user_id: string;
  };

  if (!code || !discord_user_id) {
    return { ok: false, error: "missing_args" };
  }

  const supabase = createServiceRoleClient();
  const now = new Date().toISOString();

  const { data: bindCode, error: lookupError } = await supabase
    .from("binding_codes")
    .select("*")
    .eq("code", code)
    .is("used_at", null)
    .gt("expires_at", now)
    .single();

  if (lookupError || !bindCode) {
    return { ok: false, error: "invalid_code" };
  }

  const { error: markError } = await supabase
    .from("binding_codes")
    .update({ used_at: now })
    .eq("code", code);

  if (markError) return { ok: false, error: markError.message };

  const { error: profileError } = await supabase
    .from("profiles")
    .update({ discord_user_id })
    .eq("id", bindCode.user_id);

  if (profileError) return { ok: false, error: profileError.message };

  return { ok: true, user_id: bindCode.user_id };
}

// ---------------------------------------------------------------------------
// notifyAgent — push a pitch_drafted notification + approve/reject buttons
// to every chat platform the user has bound. Generates short-lived
// chat_callback_tokens so the buttons embed only an opaque token.
// ---------------------------------------------------------------------------
async function notifyAgent(args: Args): Promise<ToolResult> {
  const { user_id, kind, payload } = args as {
    user_id: string;
    kind: string;
    payload: Record<string, unknown>;
  };

  if (!user_id || !kind || !payload) return { ok: false, error: "missing_args" };
  if (kind !== "pitch_drafted") return { ok: false, error: "unknown_kind" };

  if (process.env.OPENCLAW_GATEWAY_PRIMARY === "true") {
    const relay = await tryGatewayNotify(args);
    if (relay.ok) return { ok: true, via: "gateway", data: relay.data };
    console.warn("[notifyAgent] Gateway relay failed, falling back to direct Bot API:", relay.error);
  }

  const pitch_id = payload.pitch_id as string;
  const payload_hash = payload.payload_hash as string;
  const subject = (payload.subject as string) ?? "";
  const body = (payload.body as string) ?? "";
  const score = payload.score as number | undefined;

  if (!pitch_id || !payload_hash) return { ok: false, error: "invalid_payload" };

  const supabase = createServiceRoleClient();

  const { data: profile, error: profileErr } = await supabase
    .from("profiles")
    .select("telegram_user_id, discord_user_id")
    .eq("id", user_id)
    .single();
  if (profileErr || !profile) return { ok: false, error: "profile_not_found" };

  const platformsNotified: string[] = [];

  if (profile.telegram_user_id) {
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const approveToken = randomUUID().replace(/-/g, "");
    const rejectToken = randomUUID().replace(/-/g, "");

    const { error: tokenErr } = await supabase.from("chat_callback_tokens").insert([
      { token: approveToken, user_id, pitch_id, payload_hash, action: "approve", expires_at: expiresAt },
      { token: rejectToken, user_id, pitch_id, payload_hash, action: "reject", expires_at: expiresAt },
    ]);
    if (tokenErr) return { ok: false, error: tokenErr.message };

    const subjectLine = subject ? `<b>${escapeHtml(subject)}</b>\n\n` : "";
    const bodyExcerpt = body.length > 600 ? body.slice(0, 600) + "..." : body;
    const scoreLine = typeof score === "number" ? `\n\n📊 Score: ${score}` : "";
    const text = `📨 <b>New pitch ready for review</b>\n\n${subjectLine}${escapeHtml(bodyExcerpt)}${scoreLine}`;

    await sendTelegramMessage(profile.telegram_user_id, text, [
      [
        { text: "✅ Approve", callback_data: `act:${approveToken}` },
        { text: "❌ Reject", callback_data: `act:${rejectToken}` },
      ],
    ]);
    platformsNotified.push("telegram");
  }

  if (
    profile.discord_user_id &&
    process.env.ENABLE_DISCORD === "true" &&
    process.env.DISCORD_BOT_TOKEN
  ) {
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const approveToken = randomUUID().replace(/-/g, "");
    const rejectToken = randomUUID().replace(/-/g, "");

    const { error: tokenErr } = await supabase
      .from("chat_callback_tokens")
      .insert([
        {
          token: approveToken,
          user_id,
          pitch_id,
          payload_hash,
          action: "approve",
          expires_at: expiresAt,
        },
        {
          token: rejectToken,
          user_id,
          pitch_id,
          payload_hash,
          action: "reject",
          expires_at: expiresAt,
        },
      ]);
    if (!tokenErr) {
      const bodyExcerpt =
        body.length > 1000 ? body.slice(0, 1000) + "..." : body;
      const scoreSuffix =
        typeof score === "number" ? ` · Score: ${score}` : "";
      const embed: DiscordEmbed = {
        title: "📨 New pitch ready for review" + scoreSuffix,
        color: DISCORD_BRAND_COLOR,
        fields: [
          {
            name: subject || "Pitch",
            value: bodyExcerpt || "(no body)",
          },
        ],
      };
      const row: DiscordActionRow = {
        type: 1,
        components: [
          {
            type: 2,
            style: 3, // Success / green
            label: "✅ Approve",
            custom_id: `act:${approveToken}`,
          },
          {
            type: 2,
            style: 4, // Danger / red
            label: "❌ Reject",
            custom_id: `act:${rejectToken}`,
          },
        ],
      };
      const result = await sendDiscordDmMessage(
        profile.discord_user_id,
        embed,
        [row]
      );
      if (result.ok) platformsNotified.push("discord");
    }
  }

  return { ok: true, platforms: platformsNotified };
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export const handlers: Record<string, (args: Args) => Promise<ToolResult>> = {
  runScout,
  getRecentLeads,
  getTopLead,
  draftPitch: async (args) => {
    const { user_id, lead_id } = args as { user_id?: string; lead_id?: string };
    if (!user_id || !lead_id) return { ok: false, error: "missing_args" };
    const { ids } = await inngest.send({
      name: "pitch/draft-requested",
      data: { user_id, lead_id },
    });
    return { ok: true, job_id: ids?.[0] ?? null };
  },
  approvePitch,
  rejectPitch,
  editPitch,
  getPendingPitches,
  bindTelegram,
  bindDiscord,
  notifyAgent,
};

export const toolManifests = [
  {
    name: "runScout",
    description: "Trigger a scout pipeline run for the authenticated user.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string" },
        platform: { type: "string", enum: ["telegram", "discord", "slack"] },
        platform_user_id: { type: "string" },
        limit: { type: "number" },
      },
      required: ["query", "platform", "platform_user_id"],
    },
  },
  {
    name: "getRecentLeads",
    description: "Return the most recently scraped leads for the user.",
    inputSchema: {
      type: "object",
      properties: {
        platform: { type: "string" },
        platform_user_id: { type: "string" },
        limit: { type: "number" },
      },
      required: ["platform", "platform_user_id"],
    },
  },
  {
    name: "getTopLead",
    description: "Return the highest-scored lead for the user.",
    inputSchema: {
      type: "object",
      properties: {
        platform: { type: "string" },
        platform_user_id: { type: "string" },
      },
      required: ["platform", "platform_user_id"],
    },
  },
  {
    name: "draftPitch",
    description: "Trigger a draft-pitch run for a lead. Worker fills in the pitches row + payload_hash.",
    inputSchema: {
      type: "object",
      properties: {
        user_id: { type: "string" },
        lead_id: { type: "string" },
      },
      required: ["user_id", "lead_id"],
    },
  },
  {
    name: "approvePitch",
    description: "Approve a draft pitch. Verifies payload_hash, writes approval + audit_log, fires pitch/approved.",
    inputSchema: {
      type: "object",
      properties: {
        user_id: { type: "string" },
        pitch_id: { type: "string" },
        payload_hash: { type: "string" },
        actor_platform: { type: "string", enum: ["telegram", "discord", "web"] },
      },
      required: ["user_id", "pitch_id", "payload_hash"],
    },
  },
  {
    name: "rejectPitch",
    description: "Reject a draft pitch.",
    inputSchema: {
      type: "object",
      properties: {
        user_id: { type: "string" },
        pitch_id: { type: "string" },
        actor_platform: { type: "string", enum: ["telegram", "discord", "web"] },
      },
      required: ["user_id", "pitch_id"],
    },
  },
  {
    name: "editPitch",
    description: "Edit a draft pitch's subject and/or body. Recomputes payload_hash.",
    inputSchema: {
      type: "object",
      properties: {
        user_id: { type: "string" },
        pitch_id: { type: "string" },
        subject: { type: "string" },
        draft: { type: "string" },
        actor_platform: { type: "string", enum: ["telegram", "discord", "web"] },
      },
      required: ["user_id", "pitch_id"],
    },
  },
  {
    name: "getPendingPitches",
    description: "Get pitches awaiting approval for the user.",
    inputSchema: {
      type: "object",
      properties: {
        platform: { type: "string" },
        platform_user_id: { type: "string" },
        limit: { type: "number" },
      },
      required: ["platform", "platform_user_id"],
    },
  },
  {
    name: "bindTelegram",
    description: "Bind a Telegram user ID to an OpenClaw account via a 6-digit code.",
    inputSchema: {
      type: "object",
      properties: {
        code: { type: "string" },
        telegram_user_id: { type: "string" },
      },
      required: ["code", "telegram_user_id"],
    },
  },
  {
    name: "bindDiscord",
    description: "Bind a Discord user ID to an OpenClaw account via a 6-digit code.",
    inputSchema: {
      type: "object",
      properties: {
        code: { type: "string" },
        discord_user_id: { type: "string" },
      },
      required: ["code", "discord_user_id"],
    },
  },
  {
    name: "notifyAgent",
    description: "Worker → chat surfaces: push a pitch_drafted notification with approve/reject buttons.",
    inputSchema: {
      type: "object",
      properties: {
        user_id: { type: "string" },
        kind: { type: "string", enum: ["pitch_drafted"] },
        payload: {
          type: "object",
          properties: {
            pitch_id: { type: "string" },
            payload_hash: { type: "string" },
            subject: { type: "string" },
            body: { type: "string" },
            score: { type: "number" },
          },
          required: ["pitch_id", "payload_hash"],
        },
      },
      required: ["user_id", "kind", "payload"],
    },
  },
];
