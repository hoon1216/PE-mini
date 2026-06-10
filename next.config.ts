import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@vercel/blob", "@neondatabase/serverless"],
};

export default nextConfig;
