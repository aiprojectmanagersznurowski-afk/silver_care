import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ['@silvercare/contracts'],
};

export default nextConfig;
