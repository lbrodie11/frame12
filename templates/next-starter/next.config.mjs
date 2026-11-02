import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  eslint: {
    ignoreDuringBuilds: true,
  },
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      '@frame12/registry': resolve(__dirname, 'src/registry/index.ts'),
      '@/hooks': resolve(__dirname, 'src/registry/hooks'),
      '@/components/ui': resolve(__dirname, 'src/registry/ui'),
    };
    return config;
  },
};

export default nextConfig;
