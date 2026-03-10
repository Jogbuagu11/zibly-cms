/**
 * POST /api/pipeline/process-all
 * Fetches all raw_stories with status='new' and triggers orchestrate-pipeline for each.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getAdminClient } from '@/lib/supabase'
import { requireEditorAuth, isAuthError } from '@/lib/auth'

export async function POST(req: NextRequest) {
  const auth = await requireEditorAuth(req)
  if (isAuthError(auth)) return auth

  const supabase = getAdminClient()
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

  // Fetch all raw stories with status 'new'
  const { data: newStories, error: fetchError } = await supabase
    .from('raw_stories')
    .select('id')
    .eq('status', 'new')

  if (fetchError) {
    return NextResponse.json(
      { error: `Failed to fetch new stories: ${fetchError.message}` },
      { status: 500 },
    )
  }

  if (!newStories || newStories.length === 0) {
    return NextResponse.json({
      success: true,
      message: 'No new stories to process.',
      processed: 0,
    })
  }

  // Trigger orchestrate-pipeline for each story
  const results = await Promise.allSettled(
    newStories.map(async (story) => {
      const response = await fetch(
        `${supabaseUrl}/functions/v1/orchestrate-pipeline`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${serviceKey}`,
          },
          body: JSON.stringify({
            raw_story_id: story.id,
            triggered_by: auth.userId,
          }),
        },
      )

      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(
          data.error ?? `Pipeline failed for ${story.id} with status ${response.status}`,
        )
      }

      return { story_id: story.id, success: true }
    }),
  )

  const succeeded = results.filter((r) => r.status === 'fulfilled').length
  const failed = results.filter((r) => r.status === 'rejected').length

  const errors = results
    .filter((r): r is PromiseRejectedResult => r.status === 'rejected')
    .map((r) => String(r.reason))

  return NextResponse.json({
    success: true,
    message: `Processing triggered for ${succeeded} of ${newStories.length} stories.${
      failed > 0 ? ` ${failed} failed.` : ''
    }`,
    total: newStories.length,
    succeeded,
    failed,
    errors: errors.length > 0 ? errors : undefined,
  })
}
