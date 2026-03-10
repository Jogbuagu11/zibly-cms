/**
 * GET  /api/users  – List users with filters
 * PATCH /api/users/[id] – Update user role (admin only)
 *
 * Query: role=child|parent|editor|admin, page, limit, search
 */

import { NextRequest, NextResponse } from 'next/server'
import { getAdminClient } from '@/lib/supabase'
import { requireEditorAuth, isAuthError } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const auth = await requireEditorAuth(req)
  if (isAuthError(auth)) return auth

  const supabase = getAdminClient()
  const { searchParams } = new URL(req.url)

  const role = searchParams.get('role')
  const search = searchParams.get('search')
  const page = parseInt(searchParams.get('page') ?? '1')
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '20'), 100)
  const offset = (page - 1) * limit

  let query = supabase
    .from('users')
    .select(
      `
      id, email, display_name, avatar_url, role, age_range,
      is_coppa_user, is_verified, created_at,
      subscriptions (tier, status, current_period_end),
      parent_accounts (id, email_verified, coppa_consent_given),
      child_profiles!user_id (id, display_name, is_approved, age_range)
    `,
      { count: 'exact' }
    )
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (role) query = query.eq('role', role)
  if (search) {
    query = query.or(`email.ilike.%${search}%,display_name.ilike.%${search}%`)
  }

  const { data: users, error, count } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    users,
    pagination: { page, limit, total: count ?? 0, pages: Math.ceil((count ?? 0) / limit) },
  })
}
