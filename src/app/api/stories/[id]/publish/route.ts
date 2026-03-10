/**
 * POST /api/stories/[id]/publish
 *
 * Publishes a story to the app and sends push notifications.
 * Story must be in 'approved' status with at least one 'published' version.
 *
 * Body: { send_notifications?: boolean }
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
  const { send_notifications = true } = body

  // Verify story
  const { data: story, error: storyErr } = await supabase
    .from('stories')
    .select('id, title, status, is_breaking, audio_generated')
    .eq('id', id)
    .single()

  if (storyErr || !story) {
    return NextResponse.json({ error: 'Story not found' }, { status: 404 })
  }

  if (!['approved', 'draft'].includes(story.status)) {
    return NextResponse.json(
      { error: `Cannot publish story in '${story.status}' status` },
      { status: 400 }
    )
  }

  // Check at least one version is published/approved
  const { data: versions } = await supabase
    .from('story_versions')
    .select('age_range, status')
    .eq('story_id', id)
    .in('status', ['approved', 'published'])

  if (!versions || versions.length === 0) {
    return NextResponse.json(
      { error: 'At least one approved story version is required before publishing' },
      { status: 400 }
    )
  }

  const now = new Date().toISOString()

  // Publish story
  await supabase.from('stories').update({
    status: 'published',
    published_at: now,
  }).eq('id', id)

  // Publish all approved versions
  await supabase.from('story_versions').update({
    status: 'published',
    published_at: now,
  }).eq('story_id', id).eq('status', 'approved')

  // Send push notifications per age range
  if (send_notifications) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

    const publishedAgeRanges = versions.map((v) => v.age_range)

    const notifPromises = publishedAgeRanges.map((ageRange) =>
      fetch(`${supabaseUrl}/functions/v1/send-notifications`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${serviceKey}`,
        },
        body: JSON.stringify({
          type: story.is_breaking ? 'breaking_news' : 'new_story',
          story_id: id,
          age_range: ageRange,
          title: story.is_breaking ? `BREAKING: ${story.title}` : `New story for you!`,
          body: story.title,
          data: { story_id: id, age_range: ageRange },
        }),
      })
    )

    Promise.allSettled(notifPromises).catch(console.error)
  }

  return NextResponse.json({
    success: true,
    story_id: id,
    published_at: now,
    versions_published: versions.length,
    notifications_sent: send_notifications,
  })
}
