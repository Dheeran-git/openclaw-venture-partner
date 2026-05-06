/**
 * Registers Discord slash commands for the OpenClaw Venture Partner bot.
 * Run once after creating the bot, and again any time the command list
 * changes:
 *
 *   pnpm --filter web exec tsx scripts/registerDiscordCommands.ts
 *
 * Requires DISCORD_BOT_TOKEN and DISCORD_APP_ID in the environment.
 */
// Load env from the repo root .env (no dotenv dependency in apps/web).
// `tsx --env-file=../../.env` is the preferred invocation:
//   pnpm --filter web exec tsx --env-file=../../.env scripts/registerDiscordCommands.ts

const APP_ID = process.env.DISCORD_APP_ID;
const BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;

if (!APP_ID || !BOT_TOKEN) {
  console.error(
    "DISCORD_APP_ID and DISCORD_BOT_TOKEN must be set. See .env.example."
  );
  process.exit(1);
}

const COMMANDS = [
  {
    name: "scout",
    description: "Find new freelance leads matching your profile",
    options: [
      {
        name: "query",
        description: "What kind of work are you looking for?",
        type: 3, // STRING
        required: true,
      },
    ],
    integration_types: [0, 1], // GUILD + USER install
    contexts: [0, 1, 2], // guild + bot DM + private channel
  },
  {
    name: "pitches",
    description: "Show pending pitch approvals",
    integration_types: [0, 1],
    contexts: [0, 1, 2],
  },
  {
    name: "clients",
    description: "Open the dashboard's client list",
    integration_types: [0, 1],
    contexts: [0, 1, 2],
  },
  {
    name: "help",
    description: "Show the OpenClaw Venture Partner command list",
    integration_types: [0, 1],
    contexts: [0, 1, 2],
  },
];

async function main() {
  const url = `https://discord.com/api/v10/applications/${APP_ID}/commands`;
  // PUT replaces the entire command set atomically.
  const res = await fetch(url, {
    method: "PUT",
    headers: {
      Authorization: `Bot ${BOT_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(COMMANDS),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error(`Discord rejected commands (${res.status}):\n${text}`);
    process.exit(1);
  }

  const out = (await res.json()) as Array<{ id: string; name: string }>;
  console.log(`Registered ${out.length} commands:`);
  for (const c of out) console.log(`  - /${c.name} (${c.id})`);
}

main().catch((err) => {
  console.error("registerDiscordCommands crashed:", err);
  process.exit(1);
});
