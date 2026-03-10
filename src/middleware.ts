import { NextRequest, NextResponse } from 'next/server'

/**
 * CMS Middleware
 * - Ensures all /api/* routes require authentication (handled per-route)
 * - Sets security headers on all responses
 * - Rate limiting hint headers (actual rate limiting done at Vercel edge)
 */

export function middleware(req: NextRequest) {
  const res = NextResponse.next()

  // Security headers
  res.headers.set('X-Frame-Options', 'DENY')
  res.headers.set('X-Content-Type-Options', 'nosniff')
  res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  res.headers.set(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'self' https://*.supabase.co;"
  )
  res.headers.set('X-DNS-Prefetch-Control', 'on')
  res.headers.set(
    'Strict-Transport-Security',
    'max-age=63072000; includeSubDomains; preload'
  )
  res.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')

  // CORS for API routes – restrict to known origins in production
  const origin = req.headers.get('origin')
  const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? '').split(',').map((o) => o.trim())
  const isApiRoute = req.nextUrl.pathname.startsWith('/api/')

  if (isApiRoute && origin && allowedOrigins.includes(origin)) {
    res.headers.set('Access-Control-Allow-Origin', origin)
    res.headers.set('Access-Control-Allow-Credentials', 'true')
  }

  return res
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
