import type { NextConfig } from 'next';
import pkg from './package.json';

const nextConfig: NextConfig = {
  output: 'standalone',
  // No next/image usage; keeps the platform-specific sharp binary out of the release archive.
  images: { unoptimized: true },
  // Shown in the header and the About dialog (see src/lib/app-info.ts).
  env: { APP_VERSION: pkg.version },
};

export default nextConfig;
