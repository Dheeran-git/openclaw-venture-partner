import { handlers } from "@openclaw/agent/mcp-tools";
import { createServiceRoleClient } from "@openclaw/db";
import { checkBindRateLimit, recordBindFailure } from "../../../../lib/mcp-auth";

interface TgMessage {
  message_id: number;
  from?: { id: number; first_name?: string };
  chat: { id: number };
  text?: string;
}

interface TgUpdate {
  update_id: number;
  message?: TgMessage;
  callback_query?: {
    id: string;
    from: { id: number };
    data?: string;
    message?: TgMessage;
  };
}

async function sendMessage(chatId: number, text: string, extra?: Record<string, unknown>) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return;
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML", ...extra }),
  });
}

async function editMessageText(chatId: number, messageId: number, text: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return;
  await fetch(`https://api.telegram.org/bot${token}/editMessageText`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      message_id: messageId,
      text,
      parse_mode: "HTML",
    }),
  });
}

async function answerCbq(id: string, text?: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return;
  await fetch(`https://api.telegram.org/bot${token}/answerCallbackQuery`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ callback_query_id: id, text }),
  });
}

export async function POST(req: Request) {
  const secret = req.headers.get("X-Telegram-Bot-Api-Secret-Token");
  const expected = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (expected && secret !== expected) {
    return new Response("Unauthorized", { status: 401 });
  }

  let update: TgUpdate;
  try {
    update = await req.json();
  } catch {
    return new Response("Bad Request", { status: 400 });
  }

  // ─── Inline-button callbacks (approve / reject from Telegram) ─────────────
  if (update.callback_query) {
    const { id: cbId, data } = update.callback_query;
    const cbMessage = update.callback_query.message;
    const chatId = cbMessage?.chat.id ?? update.callback_query.from.id;

    if (!data?.startsWith("act:")) {
      await answerCbq(cbId);
      return new Response("OK");
    }

    const token = data.slice(4);
    await answerCbq(cbId, "Processing…");

    const supabase = createServiceRoleClient();
    const { data: cbToken, error: cbErr } = await supabase
      .from("chat_callback_tokens")
      .select("user_id, pitch_id, payload_hash, action, expires_at, used_at")
      .eq("token", token)
      .single();

    if (cbErr || !cbToken) {
      await sendMessage(chatId, "❌ This action link is invalid.");
      return new Response("OK");
    }
    if (cbToken.used_at) {
      await sendMessage(chatId, "⚠️ This action has already been completed.");
      return new Response("OK");
    }
    if (new Date(cbToken.expires_at) < new Date()) {
      await sendMessage(chatId, "⌛ This action link has expired. Use the dashboard.");
      return new Response("OK");
    }

    let result: { ok: boolean; error?: string };
    if (cbToken.action === "approve") {
      result = (await handlers.approvePitch!({
        user_id: cbToken.user_id,
        pitch_id: cbToken.pitch_id,
        payload_hash: cbToken.payload_hash,
        actor_platform: "telegram",
      })) as { ok: boolean; error?: string };
    } else if (cbToken.action === "reject") {
      result = (await handlers.rejectPitch!({
        user_id: cbToken.user_id,
        pitch_id: cbToken.pitch_id,
        actor_platform: "telegram",
      })) as { ok: boolean; error?: string };
    } else {
      result = { ok: false, error: "unsupported_action" };
    }

    await supabase
      .from("chat_callback_tokens")
      .update({ used_at: new Date().toISOString() })
      .eq("token", token);

    if (result.ok) {
      const verb = cbToken.action === "approve" ? "approved ✅" : "rejected ❌";
      const followup = `Pitch ${verb} via Telegram. Dashboard updated in real time.`;
      if (cbMessage) {
        await editMessageText(chatId, cbMessage.message_id, followup);
      } else {
        await sendMessage(chatId, followup);
      }
    } else if (result.error === "stale_draft") {
      await sendMessage(
        chatId,
        "⚠️ This pitch has changed since you reviewed it. Please use the dashboard."
      );
    } else if (result.error === "not_draft") {
      await sendMessage(chatId, "ℹ️ This pitch has already been actioned.");
    } else {
      await sendMessage(chatId, `Action failed: ${result.error ?? "unknown_error"}.`);
    }

    return new Response("OK");
  }

  const msg = update.message;
  if (!msg?.from) return new Response("OK");

  const chatId = msg.chat.id;
  const text = msg.text?.trim() ?? "";

  if (text === "/start" || text.startsWith("/start ")) {
    await sendMessage(
      chatId,
      `👋 Welcome to <b>OpenClaw VP</b>!\n\nTo link your account, open the dashboard, go to <b>Settings → Connect</b>, and send me the 6-digit code shown there.`
    );
    return new Response("OK");
  }

  if (/^\d{6}$/.test(text)) {
    const telegramUserIdStr = String(msg.from.id);

    const rl = checkBindRateLimit(telegramUserIdStr);
    if (!rl.allowed) {
      await sendMessage(chatId, `⏳ Too many attempts. Try again in ${rl.retryAfter}s.`);
      return new Response("OK");
    }

    const result = await handlers.bindTelegram!({
      code: text,
      telegram_user_id: telegramUserIdStr,
    });

    if (result.ok) {
      await sendMessage(
        chatId,
        `✅ <b>Account linked!</b>\n\nYou'll receive pitch notifications here. Tap the buttons to approve or reject outreach — no dashboard needed.`
      );
    } else if (result.error === "invalid_code") {
      recordBindFailure(telegramUserIdStr);
      await sendMessage(
        chatId,
        `❌ That code is invalid or expired. Refresh it in <b>Settings → Connect</b> and try again.`
      );
    } else {
      await sendMessage(chatId, `Something went wrong. Please try again.`);
    }
    return new Response("OK");
  }

  return new Response("OK");
}
