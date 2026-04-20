// next.config.mjs — InsomeOS v2.0
// Next.js 16.2.4 · React 19.2.5 · Turbopack default
// License: Apache-2.0

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // Turbopack is default in Next 16; no opt-in needed.
  experimental: {
    // React Server Components stable in 19.2
    reactCompiler: true,
    // Streaming metadata
    staleTimes: {
      dynamic: 30,
      static: 180,
    },
  },

  // i18n · Phase 0 中文锚点, Phase 1 全球
  // Note: Next.js App Router i18n uses middleware + next-intl
  // (not the legacy i18n config field)

  // Images
  images: {
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [
      { protocol: 'https', hostname: '**.supabase.co' },
      { protocol: 'https', hostname: 'cdn.insomeos.io' },
    ],
  },

  // Security headers
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains; preload',
          },
        ],
      },
    ];
  },

  // Redirects
  async redirects() {
    return [];
  },

  // Transpile packages (SDK, shared)
  transpilePackages: ['@insomeos/sdk', '@insomeos/ui'],

  // Webpack / Turbopack external module handling
  // (three.js + @react-three/fiber needs special handling in RSC)
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals = [...(config.externals ?? []), 'three'];
    }
    return config;
  },

  // Output: standalone for Docker builds
  output: 'standalone',

  // Environment
  env: {
    NEXT_PUBLIC_APP_VERSION: '2.0.0',
    NEXT_PUBLIC_BUILD_ID: process.env.GIT_COMMIT_SHA ?? 'dev',
  },
};

export default nextConfig;
