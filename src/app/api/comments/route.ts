/**
 * GET /api/comments  – Get moderation queue comments
 *
 * Query params:
 *   status=pending|approved|rejected
 *   story_id=uuid
 *   page=1&limit=20
 */

import { NextRequest, NextResponse } from 'next/server'
import { getAdminClient } from '@/lib/supabase'
import { requireEditorAuth, isAuthError } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const auth = await requireEditorAuth(req)
  if (isAuthError(auth)) return auth

  const supabase = getAdminClient()
  const { searchParams } = new URL(req.url)

  const status = searchParams.get('status') ?? 'pending'
  const storyId = searchParams.get('story_id')
  const page = parseInt(searchParams.get('page') ?? '1')
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '20'), 100)
  const offset = (page - 1) * limit

  let query = supabase
    .from('comments')
    .select(
      `
      id, content, status, requires_parent_approval, parent_approved,
      rejection_reason, created_at,
      stories!story_id (id, title, slug),
      users!author_id (id, display_name, avatar_url, is_coppa_user, age_range),
      comments!parent_id (id, content)
    `,
      { count: 'exact' }
    )
    .eq('status', status)
    .order('created_at', { ascending: true })
    .range(offset, offset + limit - 1)

  if (storyId) query = query.eq('story_id', storyId)

  const { data: comments, error, count } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    comments,
    pagination: { page, limit, total: count ?? 0, pages: Math.ceil((count ?? 0) / limit) },
  })
}
