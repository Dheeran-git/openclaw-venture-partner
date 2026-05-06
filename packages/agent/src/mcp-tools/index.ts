import { createServiceRoleClient } from "@openclaw/db";
import { Inngest } from "inngest";

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
// Full implementations
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

  const { data: bindCode, error: lookupError } = await supabase
    .from("binding_codes")
    .select("*")
    .eq("code", code)
    .eq("platform", "telegram")
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
    .eq("platform", "discord")
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
// Stubs (filled in Steps 6d–6e)
// ---------------------------------------------------------------------------

function notImplemented(): ToolResult {
  return { ok: false, error: "not_implemented" };
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export const handlers: Record<string, (args: Args) => Promise<ToolResult>> = {
  runScout,
  getRecentLeads,
  getTopLead,
  draftPitch:        async () => notImplemented(),
  approvePitch:      async () => notImplemented(),
  rejectPitch:       async () => notImplemented(),
  editPitch:         async () => notImplemented(),
  getPendingPitches: async () => notImplemented(),
  bindTelegram,
  bindDiscord,
  notifyAgent:       async () => notImplemented(),
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
    description: "Draft a pitch for a lead (not yet implemented).",
    inputSchema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "approvePitch",
    description: "Approve a pitch (not yet implemented).",
    inputSchema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "rejectPitch",
    description: "Reject a pitch (not yet implemented).",
    inputSchema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "editPitch",
    description: "Edit a pitch draft (not yet implemented).",
    inputSchema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "getPendingPitches",
    description: "Get pitches awaiting approval (not yet implemented).",
    inputSchema: { type: "object", properties: {}, required: [] },
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
    description: "Worker → Gateway: push a notification to a user's chat session.",
    inputSchema: {
      type: "object",
      properties: {
        user_id: { type: "string" },
        kind: { type: "string" },
        payload: { type: "object" },
      },
      required: ["user_id", "kind", "payload"],
    },
  },
];
