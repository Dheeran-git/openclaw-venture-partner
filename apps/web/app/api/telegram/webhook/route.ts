import { handlers } from "@openclaw/agent/mcp-tools";
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

  // Inline keyboard callbacks (Step 6e: pitch approve/reject)
  if (update.callback_query) {
    const { id: cbId, from, data } = update.callback_query;
    const chatId = update.callback_query.message?.chat.id ?? from.id;
    if (data?.startsWith("act:")) {
      await answerCbq(cbId, "Processing…");
      // Token resolution implemented in Step 6e
      await sendMessage(chatId, "Pitch approval via Telegram is coming in the next update.");
    } else {
      await answerCbq(cbId);
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
