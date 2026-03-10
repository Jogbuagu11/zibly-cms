/**
 * GET /api/pipeline/server-status
 * Proxies the render server health check to avoid mixed-content/CORS issues.
 */

import { NextResponse } from 'next/server'

const RENDER_SERVER_URL = process.env.RENDER_SERVER_URL ?? 'http://204.168.150.82:3100'

export async function GET() {
  try {
    const res = await fetch(`${RENDER_SERVER_URL}/health`, {
      signal: AbortSignal.timeout(5000),
    })

    if (!res.ok) {
      return NextResponse.json({ online: false }, { status: 200 })
    }

    const data = await res.json()
    return NextResponse.json({ online: true, ...data })
  } catch {
    return NextResponse.json({ online: false }, { status: 200 })
  }
}
