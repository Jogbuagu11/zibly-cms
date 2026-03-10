/**
 * POST /api/pipeline/process
 * Triggers orchestrate-pipeline for a single raw story.
 * Body: { raw_story_id: string }
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireEditorAuth, isAuthError } from '@/lib/auth'

export async function POST(req: NextRequest) {
  const auth = await requireEditorAuth(req)
  if (isAuthError(auth)) return auth

  let body: { raw_story_id?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { raw_story_id } = body
  if (!raw_story_id) {
    return NextResponse.json({ error: 'raw_story_id is required' }, { status: 400 })
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

  try {
    const response = await fetch(
      `${supabaseUrl}/functions/v1/orchestrate-pipeline`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${serviceKey}`,
        },
        body: JSON.stringify({
          raw_story_id,
          triggered_by: auth.userId,
        }),
      },
    )

    if (!response.ok) {
      const data = await response.json().catch(() => ({}))
      return NextResponse.json(
        { error: data.error ?? `Pipeline failed with status ${response.status}` },
        { status: response.status },
      )
    }

    const data = await response.json().catch(() => ({}))

    return NextResponse.json({
      success: true,
      message: data.message ?? `Pipeline triggered for story.`,
      ...data,
    })
  } catch (err) {
    console.error('Pipeline process error:', err)
    return NextResponse.json(
      { error: 'Failed to trigger pipeline edge function' },
      { status: 500 },
    )
  }
}
