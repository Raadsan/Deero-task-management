import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadEnvConfig } from "@next/env";

const frontendDir = path.dirname(fileURLToPath(import.meta.url));
const backendDir = path.join(frontendDir, "..", "backend");

// Single env file: backend/.env (API + Next public URLs)
loadEnvConfig(backendDir);

const apiPublicUrl =
  process.env.NEXT_PUBLIC_API_URL ||
  process.env.BETTER_AUTH_URL ||
  "http://localhost:7003";

const frontendOrigin =
  process.env.FRONTEND_URL?.replace(/\/$/, "") || "http://localhost:2003";

// Never use `PORT` here — `next dev -p 2003` sets PORT to the frontend port.
const backendPort = process.env.BACKEND_PORT || "7003";
const backendRewriteTarget = (
  process.env.API_INTERNAL_URL ||
  `http://127.0.0.1:${backendPort}`
).replace(/\/$/, "");

const nextConfig: NextConfig = {
  reactCompiler: true,
  env: {
    NEXT_PUBLIC_API_URL: apiPublicUrl,
    NEXT_PUBLIC_BETTER_AUTH_URL:
      process.env.NEXT_PUBLIC_BETTER_AUTH_URL ||
      process.env.BETTER_AUTH_URL ||
      apiPublicUrl,
    NEXT_PUBLIC_APP_ORIGIN: frontendOrigin,
    BETTER_AUTH_URL: process.env.BETTER_AUTH_URL || apiPublicUrl,
    BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET,
  },
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${backendRewriteTarget}/api/:path*`,
      },
      {
        source: "/uploads/:path*",
        destination: `${backendRewriteTarget}/uploads/:path*`,
      },
    ];
  },
  // Remote DB + heavy accounting list routes can exceed the default 30s rewrite proxy.
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
    proxyTimeout: 120_000,
  },
  httpAgentOptions: {
    keepAlive: false,
  },
  images: {
    remotePatterns: [
      {
        protocol: "http",
        hostname: "localhost",
        port: "7003",
        pathname: "/uploads/**",
      },
      {
        protocol: "https",
        hostname: "task.deero.so",
        pathname: "/uploads/**",
      },
    ],
  },
};

export default nextConfig;