import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  serverActions: {
    bodySizeLimit: "10mb",
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
