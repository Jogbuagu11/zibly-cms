/**
 * POST   /api/comments/[id]/approve  – handled in approve/route.ts
 * POST   /api/comments/[id]/reject   – handled in reject/route.ts
 * DELETE /api/comments/[id]          – hard delete (admin only)
 */

import { NextRequest, NextResponse } from 'next/server'
import { getAdminClient } from '@/lib/supabase'
import { requireEditorAuth, isAuthError } from '@/lib/auth'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const auth = await requireEditorAuth(req)
  if (isAuthError(auth)) return auth

  const supabase = getAdminClient()

  const { data: comment, error } = await supabase
    .from('comments')
    .select(`
      *,
      stories!story_id (id, title, slug),
      users!author_id (id, display_name, avatar_url, is_coppa_user, age_range),
      users!moderated_by (display_name)
    `)
    .eq('id', id)
    .single()

  if (error || !comment) {
    return NextResponse.json({ error: 'Comment not found' }, { status: 404 })
  }

  return NextResponse.json({ comment })
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const auth = await requireEditorAuth(req)
  if (isAuthError(auth)) return auth

  if (auth.role !== 'admin') {
    return NextResponse.json({ error: 'Admin role required' }, { status: 403 })
  }

  const supabase = getAdminClient()

  const { error } = await supabase
    .from('comments')
    .delete()
    .eq('id', id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
