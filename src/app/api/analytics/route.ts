/**
 * GET /api/analytics  – Story and platform analytics
 *
 * Query:
 *   story_id=uuid  – analytics for a specific story
 *   period=7d|30d|90d  – time period (default 30d)
 *   category=slug  – filter by category
 */

import { NextRequest, NextResponse } from 'next/server'
import { getAdminClient } from '@/lib/supabase'
import { requireEditorAuth, isAuthError } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const auth = await requireEditorAuth(req)
  if (isAuthError(auth)) return auth

  const supabase = getAdminClient()
  const { searchParams } = new URL(req.url)

  const storyId = searchParams.get('story_id')
  const period = searchParams.get('period') ?? '30d'
  const category = searchParams.get('category')

  const periodDays = period === '7d' ? 7 : period === '90d' ? 90 : 30
  const since = new Date()
  since.setDate(since.getDate() - periodDays)
  const sinceIso = since.toISOString()

  // Single story analytics
  if (storyId) {
    const { data: story } = await supabase
      .from('story_analytics')
      .select('*')
      .eq('id', storyId)
      .single()

    const { data: dailyReads } = await supabase
      .from('reading_history')
      .select('read_date, read_pct, listened, age_range')
      .eq('story_id', storyId)
      .gte('read_at', sinceIso)

    // Group by day
    const byDay: Record<string, { reads: number; listens: number }> = {}
    ;(dailyReads ?? []).forEach((r: { read_date: string; listened: boolean }) => {
      byDay[r.read_date] = byDay[r.read_date] ?? { reads: 0, listens: 0 }
      byDay[r.read_date].reads++
      if (r.listened) byDay[r.read_date].listens++
    })

    // Age range breakdown
    const ageRangeBreakdown: Record<string, number> = {}
    ;(dailyReads ?? []).forEach((r: { age_range: string }) => {
      ageRangeBreakdown[r.age_range] = (ageRangeBreakdown[r.age_range] ?? 0) + 1
    })

    return NextResponse.json({
      story,
      daily_reads: byDay,
      age_range_breakdown: ageRangeBreakdown,
      period: `${periodDays}d`,
    })
  }

  // Platform-wide analytics
  const [
    { data: topStories },
    { data: categoryBreakdown },
    { data: totalReadsResult },
    { data: activeUsersResult },
    { data: subscriptionStats },
  ] = await Promise.all([
    supabase
      .from('story_analytics')
      .select('id, title, view_count, unique_readers, avg_read_pct, category_name')
      .order('view_count', { ascending: false })
      .limit(10),

    supabase
      .from('reading_history')
      .select('stories!story_id (categories!category_id (name))')
      .gte('read_at', sinceIso),

    supabase
      .from('reading_history')
      .select('id', { count: 'exact', head: true })
      .gte('read_at', sinceIso),

    supabase
      .from('reading_history')
      .select('user_id')
      .gte('read_at', sinceIso),

    supabase.from('subscription_stats').select('*'),
  ])

  const uniqueActiveUsers = new Set(
    (activeUsersResult ?? []).map((r: { user_id: string }) => r.user_id)
  ).size

  return NextResponse.json({
    period: `${periodDays}d`,
    total_reads: totalReadsResult ?? 0,
    unique_active_users: uniqueActiveUsers,
    top_stories: topStories,
    subscription_stats: subscriptionStats,
  })
}
