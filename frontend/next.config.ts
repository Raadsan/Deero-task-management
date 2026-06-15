import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
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
