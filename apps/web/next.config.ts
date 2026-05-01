import type { NextConfig } from "next";

const config: NextConfig = {
  reactStrictMode: true,
  transpilePackages: [
    "@openclaw/agent",
    "@openclaw/db",
    "@openclaw/shared",
    "@openclaw/worker",
  ],
  experimental: {
    typedRoutes: true,
  },
};

export default config;
