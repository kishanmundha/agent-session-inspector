import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  // No next/image usage; keeps the platform-specific sharp binary out of the release archive.
  images: { unoptimized: true },
};

export default nextConfig;
