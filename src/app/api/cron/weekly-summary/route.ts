/**
 * GET /api/cron/weekly-summary
 * Called by Vercel Cron every Sunday at 08:00 UTC.
 * Protected by CRON_SECRET.
 */

import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

  const response = await fetch(`${supabaseUrl}/functions/v1/weekly-summary`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${serviceKey}`,
    },
    body: JSON.stringify({}),
  })

  const result = await response.json()
  return NextResponse.json(result, { status: response.ok ? 200 : 500 })
}
