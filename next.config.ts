import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // CMS is server-side only – no static export
  output: 'standalone',

  experimental: {
    serverActions: {
      allowedOrigins: ['localhost:3001', process.env.VERCEL_URL ?? ''].filter(Boolean),
    },
  },

  // Allowed image domains for Supabase Storage and Unsplash
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
      {
        protocol: 'https',
        hostname: 'plus.unsplash.com',
      },
    ],
  },

  // Headers set in middleware, but also add cache control defaults
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          { key: 'Cache-Control', value: 'no-store, max-age=0' },
        ],
      },
    ]
  },
}

export default nextConfig
