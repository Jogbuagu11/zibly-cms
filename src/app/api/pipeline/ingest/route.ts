/**
 * POST /api/pipeline/ingest
 * Triggers the Supabase ingest-stories edge function.
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireEditorAuth, isAuthError } from '@/lib/auth'

export async function POST(req: NextRequest) {
  const auth = await requireEditorAuth(req)
  if (isAuthError(auth)) return auth

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/ingest-stories`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({ triggered_by: auth.userId }),
    })

    if (!response.ok) {
      const body = await response.json().catch(() => ({}))
      return NextResponse.json(
        { error: body.error ?? `Ingestion failed with status ${response.status}` },
        { status: response.status },
      )
    }

    const data = await response.json().catch(() => ({}))

    return NextResponse.json({
      success: true,
      message: data.message ?? 'Ingestion started successfully.',
      ...data,
    })
  } catch (err) {
    console.error('Ingestion error:', err)
    return NextResponse.json(
      { error: 'Failed to trigger ingestion edge function' },
      { status: 500 },
    )
  }
}
