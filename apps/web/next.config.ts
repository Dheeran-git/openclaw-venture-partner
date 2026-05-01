import type { NextConfig } from "next";

const config: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@openclaw/agent", "@openclaw/db", "@openclaw/shared"],
  experimental: {
    typedRoutes: true,
  },
};

export default config;
