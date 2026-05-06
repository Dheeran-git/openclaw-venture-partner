import type { NextConfig } from "next";

const config: NextConfig = {
  reactStrictMode: true,
  typedRoutes: true,
  transpilePackages: [
    "@openclaw/agent",
    "@openclaw/db",
    "@openclaw/shared",
    "@openclaw/worker",
  ],
};

export default config;
