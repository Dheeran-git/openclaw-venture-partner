import { config as loadEnv } from "dotenv";

loadEnv({ path: "../../.env" });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!.replace(/\/+$/, "").replace(
  /\/(rest|auth|storage|realtime)\/v1$/i,
  ""
);
const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function head(table: string) {
  const res = await fetch(`${url}/rest/v1/${table}?select=*`, {
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      Prefer: "count=exact",
      Range: "0-0",
    },
  });
  const total = res.headers.get("content-range")?.split("/")[1] ?? "?";
  console.log(`  ${table.padEnd(12)}  ${res.status}  rows=${total}`);
}

console.log("Tables:");
for (const t of ["profiles", "sources", "leads", "scores", "pitches", "clients", "approvals", "llm_calls"]) {
  await head(t);
}
