import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    "/api/surveys/[id]/export/pdf": ["./assets/fonts/**/*"],
  },
};

export default nextConfig;
