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

const nextConfig: NextConfig = {
  reactCompiler: true,
  env: {
    NEXT_PUBLIC_API_URL: apiPublicUrl,
    NEXT_PUBLIC_BETTER_AUTH_URL:
      process.env.NEXT_PUBLIC_BETTER_AUTH_URL ||
      process.env.BETTER_AUTH_URL ||
      apiPublicUrl,
    BETTER_AUTH_URL: process.env.BETTER_AUTH_URL || apiPublicUrl,
    BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET,
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
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