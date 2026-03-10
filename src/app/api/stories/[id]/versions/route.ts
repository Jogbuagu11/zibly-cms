/**
 * GET   /api/stories/[id]/versions        – Get all versions for a story
 * PATCH /api/stories/[id]/versions        – Update a specific version's content
 *
 * Body for PATCH: { age_range: string, rewritten_content: string, note?: string }
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

  const { data: versions, error } = await supabase
    .from('story_versions')
    .select(`
      *,
      users!reviewed_by (display_name)
    `)
    .eq('story_id', id)
    .order('age_range', { ascending: true })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ versions })
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const auth = await requireEditorAuth(req)
  if (isAuthError(auth)) return auth

  const supabase = getAdminClient()

  const body = await req.json().catch(() => null)
  if (!body || !body.age_range || !body.rewritten_content) {
    return NextResponse.json(
      { error: 'age_range and rewritten_content are required' },
      { status: 400 }
    )
  }

  const { age_range, rewritten_content, note } = body

  // Update version – reset to review status after edit
  const { data: version, error: vErr } = await supabase
    .from('story_versions')
    .update({
      rewritten_content,
      word_count: rewritten_content.split(/\s+/).length,
      status: 'review',
      // Clear audio since content changed
      audio_url: null,
      audio_duration_s: null,
      reviewed_by: null,
      reviewed_at: null,
    })
    .eq('story_id', id)
    .eq('age_range', age_range)
    .select()
    .single()

  if (vErr) {
    return NextResponse.json({ error: vErr.message }, { status: 500 })
  }

  if (note) {
    await supabase.from('editor_notes').insert({
      story_id: id,
      version_id: version.id,
      author_id: auth.userId,
      note,
    })
  }

  return NextResponse.json({ version })
}
