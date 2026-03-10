/**
 * POST /api/notifications  – Send a manual push notification
 *
 * Body:
 *   { type, title, body, story_id?, age_range?, user_ids? }
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireEditorAuth, isAuthError } from '@/lib/auth'

export async function POST(req: NextRequest) {
  const auth = await requireEditorAuth(req)
  if (isAuthError(auth)) return auth

  let body: {
    type: string
    title: string
    body: string
    story_id?: string
    age_range?: string
    user_ids?: string[]
  }

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (!body.type || !body.title || !body.body) {
    return NextResponse.json(
      { error: 'type, title, and body are required' },
      { status: 400 }
    )
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

  const response = await fetch(`${supabaseUrl}/functions/v1/send-notifications`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${serviceKey}`,
    },
    body: JSON.stringify(body),
  })

  const result = await response.json()

  if (!response.ok) {
    return NextResponse.json({ error: result.error }, { status: response.status })
  }

  return NextResponse.json(result)
}
