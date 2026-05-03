import { config as loadEnv } from "dotenv";
loadEnv({ path: "../../.env" });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!.replace(/\/+$/, "").replace(
  /\/(rest|auth|storage|realtime)\/v1$/i,
  ""
);
const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const res = await fetch(
  `${url}/rest/v1/llm_calls?select=id,purpose,provider,model,duration_ms,created_at&order=created_at.desc&limit=5`,
  { headers: { apikey: key, Authorization: `Bearer ${key}` } }
);
const rows = (await res.json()) as Array<Record<string, unknown>>;

console.log(
  `\n${"id".padEnd(38)} ${"purpose".padEnd(14)} ${"provider".padEnd(11)} ${"model".padEnd(28)} ${"ms".padStart(5)}  created_at`
);
console.log("-".repeat(120));
for (const r of rows) {
  console.log(
    `${String(r.id).padEnd(38)} ${String(r.purpose).padEnd(14)} ${String(r.provider).padEnd(11)} ${String(r.model).padEnd(28)} ${String(r.duration_ms).padStart(5)}  ${r.created_at}`
  );
}
console.log(`\n${rows.length} rows.\n`);
