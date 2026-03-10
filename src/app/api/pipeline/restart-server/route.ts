/**
 * POST /api/pipeline/restart-server
 * Restarts the Hetzner video render server via its /restart endpoint.
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireEditorAuth, isAuthError } from '@/lib/auth'

const RENDER_SERVER_URL = process.env.RENDER_SERVER_URL ?? 'http://204.168.150.82:3100'
const RENDER_SERVER_SECRET = process.env.RENDER_SERVER_SECRET ?? ''

export async function POST(req: NextRequest) {
  const auth = await requireEditorAuth(req)
  if (isAuthError(auth)) return auth

  try {
    const response = await fetch(`${RENDER_SERVER_URL}/restart`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${RENDER_SERVER_SECRET}`,
      },
    })

    if (!response.ok) {
      return NextResponse.json(
        { error: `Server returned ${response.status}` },
        { status: response.status },
      )
    }

    return NextResponse.json({ success: true, message: 'Render server restarting...' })
  } catch {
    return NextResponse.json(
      { error: 'Could not reach render server' },
      { status: 502 },
    )
  }
}
