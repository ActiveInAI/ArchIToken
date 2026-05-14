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

  images: {
    formats: ['image/avif', 'image/webp'],
  },

  output: 'standalone',
};

export default nextConfig;
