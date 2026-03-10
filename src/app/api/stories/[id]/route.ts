/**
 * GET    /api/stories/[id]  – Get story with all versions, map, photos
 * PATCH  /api/stories/[id]  – Update story fields
 * DELETE /api/stories/[id]  – Soft-delete (archive) story
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

  const { data: story, error } = await supabase
    .from('stories')
    .select(`
      *,
      categories (id, name, slug, color),
      users!author_id (id, display_name, email, avatar_url),
      story_versions (*),
      story_maps (*),
      story_photos (*)
    `)
    .eq('id', id)
    .single()

  if (error || !story) {
    return NextResponse.json({ error: 'Story not found' }, { status: 404 })
  }

  // Fetch moderation queue items
  const { data: queueItems } = await supabase
    .from('content_moderation_queue')
    .select('*')
    .eq('content_id', id)
    .order('created_at', { ascending: false })

  // Fetch editor notes
  const { data: notes } = await supabase
    .from('editor_notes')
    .select('*, users!author_id (display_name)')
    .eq('story_id', id)
    .order('created_at', { ascending: false })

  return NextResponse.json({ story, moderation_queue: queueItems, notes })
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const auth = await requireEditorAuth(req)
  if (isAuthError(auth)) return auth

  const supabase = getAdminClient()

  let updates: Record<string, unknown>
  try {
    updates = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  // Prevent direct status changes through this endpoint
  // (status changes happen via /approve and /publish endpoints)
  delete updates.status
  delete updates.id
  delete updates.author_id
  delete updates.created_at

  const { data, error } = await supabase
    .from('stories')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ story: data })
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const auth = await requireEditorAuth(req)
  if (isAuthError(auth)) return auth

  if (auth.role !== 'admin') {
    return NextResponse.json({ error: 'Admin role required for deletion' }, { status: 403 })
  }

  const supabase = getAdminClient()

  // Soft delete – archive instead of destroy
  const { error } = await supabase
    .from('stories')
    .update({ status: 'archived' })
    .eq('id', id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true, message: 'Story archived' })
}
