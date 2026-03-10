/**
 * POST /api/stories/[id]/approve
 *
 * Approves a specific story version (or all versions if no age_range given).
 * After approval, triggers audio generation via ElevenLabs.
 *
 * Body: { age_range?: '7-10' | '11-14' | '15-17', note?: string }
 */

import { NextRequest, NextResponse } from 'next/server'
import { getAdminClient } from '@/lib/supabase'
import { requireEditorAuth, isAuthError } from '@/lib/auth'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const auth = await requireEditorAuth(req)
  if (isAuthError(auth)) return auth

  const supabase = getAdminClient()
  const body = await req.json().catch(() => ({}))
  const { age_range, note } = body

  // Verify story exists and is in 'review' status
  const { data: story, error: storyErr } = await supabase
    .from('stories')
    .select('id, status, title')
    .eq('id', id)
    .single()

  if (storyErr || !story) {
    return NextResponse.json({ error: 'Story not found' }, { status: 404 })
  }

  if (story.status !== 'review') {
    return NextResponse.json(
      { error: `Story must be in 'review' status. Current status: ${story.status}` },
      { status: 400 }
    )
  }

  // Approve versions
  let versionQuery = supabase
    .from('story_versions')
    .update({
      status: 'approved',
      reviewed_by: auth.userId,
      reviewed_at: new Date().toISOString(),
    })
    .eq('story_id', id)
    .eq('status', 'review')

  if (age_range) {
    versionQuery = versionQuery.eq('age_range', age_range)
  }

  const { data: approvedVersions, error: versionErr } = await versionQuery.select()

  if (versionErr) {
    return NextResponse.json({ error: versionErr.message }, { status: 500 })
  }

  // Update story status to approved if all versions are approved
  const { data: allVersions } = await supabase
    .from('story_versions')
    .select('status')
    .eq('story_id', id)

  const allApproved = allVersions?.every((v) => v.status === 'approved')
  if (allApproved) {
    await supabase.from('stories').update({ status: 'approved' }).eq('id', id)
  }

  // Add editor note if provided
  if (note) {
    await supabase.from('editor_notes').insert({
      story_id: id,
      author_id: auth.userId,
      note: `Approved ${age_range ? `(${age_range})` : '(all versions)'}: ${note}`,
    })
  }

  // Resolve moderation queue items
  await supabase
    .from('content_moderation_queue')
    .update({
      action: 'approve',
      resolved_at: new Date().toISOString(),
      assigned_to: auth.userId,
    })
    .eq('content_id', id)
    .is('resolved_at', null)

  // Trigger audio generation
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

  fetch(`${supabaseUrl}/functions/v1/generate-audio`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${serviceKey}`,
    },
    body: JSON.stringify({ story_id: id }),
  }).catch((err) => console.error('Audio generation trigger failed:', err))

  return NextResponse.json({
    success: true,
    story_id: id,
    versions_approved: approvedVersions?.length ?? 0,
    all_approved: allApproved,
    audio_generation_triggered: true,
  })
}
