/**
 * Loads the monorepo-root .env into the Next.js process so server-side
 * code (API routes, the Inngest /api/inngest serve handler) sees the
 * Supabase keys, the demo user id, and any other env we keep at the
 * repo root rather than per-app. Without this, `createServerClient`
 * throws "NEXT_PUBLIC_SUPABASE_URL must be set" inside the Inngest
 * function execution.
 */
import nextEnv from "@next/env";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
nextEnv.loadEnvConfig(join(__dirname, "..", ".."));

/** @type {import('next').NextConfig} */
const config = {};

export default config;
