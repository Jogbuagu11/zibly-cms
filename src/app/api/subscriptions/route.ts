/**
 * GET  /api/subscriptions  – List subscriptions with stats
 * POST /api/subscriptions/cancel – Cancel a subscription
 */

import { NextRequest, NextResponse } from 'next/server'
import { getAdminClient } from '@/lib/supabase'
import { requireEditorAuth, isAuthError } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const auth = await requireEditorAuth(req)
  if (isAuthError(auth)) return auth

  const supabase = getAdminClient()
  const { searchParams } = new URL(req.url)

  const tier = searchParams.get('tier')
  const status = searchParams.get('status') ?? 'active'
  const page = parseInt(searchParams.get('page') ?? '1')
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '20'), 100)
  const offset = (page - 1) * limit

  // Aggregate stats
  const { data: stats } = await supabase
    .from('subscription_stats')
    .select('*')

  // List subscriptions
  let query = supabase
    .from('subscriptions')
    .select(
      `
      id, tier, status, plan_name, amount_cents, currency, interval,
      current_period_start, current_period_end, cancel_at_period_end, created_at,
      users!user_id (id, email, display_name)
    `,
      { count: 'exact' }
    )
    .eq('status', status)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (tier) query = query.eq('tier', tier)

  const { data: subscriptions, error, count } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Calculate MRR
  const activeSubs = (stats ?? []).filter((s: { status: string }) => s.status === 'active')
  const mrr = activeSubs.reduce((sum: number, s: { total_mrr_usd: number; interval: string }) => {
    const monthly = s.interval === 'year' ? s.total_mrr_usd / 12 : s.total_mrr_usd
    return sum + monthly
  }, 0)

  return NextResponse.json({
    subscriptions,
    stats: {
      by_tier: stats,
      mrr_usd: Math.round(mrr * 100) / 100,
      total_active: activeSubs.reduce(
        (sum: number, s: { count: number }) => sum + s.count, 0
      ),
    },
    pagination: { page, limit, total: count ?? 0, pages: Math.ceil((count ?? 0) / limit) },
  })
}
