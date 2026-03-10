/**
 * GET  /api/stories  – List stories (with filters)
 * POST /api/stories  – Submit a new story and trigger content pipeline
 */

import { NextRequest, NextResponse } from 'next/server'
import { getAdminClient } from '@/lib/supabase'
import { requireEditorAuth, isAuthError } from '@/lib/auth'

// GET /api/stories?status=draft&category=world&page=1&limit=20
export async function GET(req: NextRequest) {
  const auth = await requireEditorAuth(req)
  if (isAuthError(auth)) return auth

  const supabase = getAdminClient()
  const { searchParams } = new URL(req.url)

  const status = searchParams.get('status')
  const category = searchParams.get('category')
  const page = parseInt(searchParams.get('page') ?? '1')
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '20'), 100)
  const offset = (page - 1) * limit

  let query = supabase
    .from('stories')
    .select(`
      id, title, slug, summary, status, is_breaking,
      published_at, view_count, like_count,
      versions_generated, audio_generated, map_fetched, photos_fetched,
      created_at, updated_at,
      categories (id, name, slug, color),
      users!author_id (id, display_name, avatar_url),
      story_versions (age_range, status, word_count, audio_url)
    `, { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (status) query = query.eq('status', status)
  if (category) query = query.eq('categories.slug', category)

  const { data: stories, error, count } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    stories,
    pagination: { page, limit, total: count ?? 0, pages: Math.ceil((count ?? 0) / limit) },
  })
}

// POST /api/stories
export async function POST(req: NextRequest) {
  const auth = await requireEditorAuth(req)
  if (isAuthError(auth)) return auth

  const supabase = getAdminClient()

  let body: {
    title: string
    summary: string
    master_content: string
    category_id: string
    cover_image_url?: string
    source_url?: string
    source_name?: string
    is_breaking?: boolean
    location_queries?: string[]
    photo_search_queries?: string[]
  }

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { title, summary, master_content, category_id } = body
  if (!title || !summary || !master_content || !category_id) {
    return NextResponse.json(
      { error: 'title, summary, master_content, and category_id are required' },
      { status: 400 }
    )
  }

  // Generate URL-safe slug
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 80) + '-' + Date.now().toString(36)

  // Insert story
  const { data: story, error: storyErr } = await supabase
    .from('stories')
    .insert({
      title,
      slug,
      summary,
      master_content,
      category_id,
      author_id: auth.userId,
      cover_image_url: body.cover_image_url,
      source_url: body.source_url,
      source_name: body.source_name,
      is_breaking: body.is_breaking ?? false,
      status: 'draft',
    })
    .select()
    .single()

  if (storyErr) {
    return NextResponse.json({ error: storyErr.message }, { status: 500 })
  }

  // Trigger content pipeline asynchronously
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

  // Fire and forget – pipeline runs asynchronously
  const pipelinePromises: Promise<Response>[] = [
    fetch(`${supabaseUrl}/functions/v1/process-story`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({ story_id: story.id }),
    }),
  ]

  if (body.location_queries?.length) {
    pipelinePromises.push(
      fetch(`${supabaseUrl}/functions/v1/fetch-map-data`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${serviceKey}`,
        },
        body: JSON.stringify({
          story_id: story.id,
          location_queries: body.location_queries,
        }),
      })
    )
  }

  if (body.photo_search_queries?.length) {
    pipelinePromises.push(
      fetch(`${supabaseUrl}/functions/v1/fetch-photos`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${serviceKey}`,
        },
        body: JSON.stringify({
          story_id: story.id,
          search_queries: body.photo_search_queries,
        }),
      })
    )
  }

  // Don't await – let pipeline run in background
  Promise.allSettled(pipelinePromises).catch((err) =>
    console.error('Pipeline error:', err)
  )

  return NextResponse.json(
    {
      success: true,
      story,
      message: 'Story submitted. Content pipeline started (versions, maps, photos).',
    },
    { status: 201 }
  )
}
