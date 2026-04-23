import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Required for the future Docker build (E10).
  output: "standalone",
};

export default nextConfig;
