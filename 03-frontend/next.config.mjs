import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const browserEmptyNodeModule = join(
  __dirname,
  'lib',
  'browser-empty-node-module.ts',
);
const browserEmptyNodeModuleAlias = './lib/browser-empty-node-module.ts';

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // 允许局域网访问 dev server
  allowedDevOrigins: ['192.168.1.100', '127.0.0.1', 'localhost'],

  experimental: {
    staleTimes: {
      dynamic: 30,
      static: 180,
    },
  },

  turbopack: {
    resolveAlias: {
      fs: {
        browser: browserEmptyNodeModuleAlias,
      },
    },
  },

  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve = config.resolve || {};
      config.resolve.alias = {
        ...(config.resolve.alias || {}),
        fs: browserEmptyNodeModule,
      };
      config.resolve.fallback = {
        ...(config.resolve.fallback || {}),
        fs: false,
      };
    }
    return config;
  },

  images: {
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
    ],
  },

  output: 'standalone',
  outputFileTracingExcludes: {
    '/*': [
      './next.config.mjs',
      './.architoken/**/*',
      './playwright-report/**/*',
      './runtime/**/*',
      './test-results/**/*',
    ],
    '/api/local-files/*/preview': [
      './next.config.mjs',
      './.architoken/**/*',
      './playwright-report/**/*',
      './runtime/**/*',
      './test-results/**/*',
    ],
  },
};

export default nextConfig;
