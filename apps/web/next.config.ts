import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  transpilePackages: ["@lead-radar/ui", "@lead-radar/types"],
};

export default nextConfig;
