import type { NextConfig } from "next";

const nextConfig: any = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  experimental: {
    optimizePackageImports: ['lucide-react', 'recharts', 'papaparse', '@clerk/nextjs'],
  },
};

export default nextConfig;
