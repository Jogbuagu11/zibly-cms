import { NextRequest, NextResponse } from 'next/server'
import { getAdminClient } from './supabase'

export interface AuthContext {
  userId: string
  role: 'editor' | 'admin'
}

/**
 * Validates the request JWT and confirms the user has editor or admin role.
 * Returns AuthContext on success, or a NextResponse error to return immediately.
 */
export async function requireEditorAuth(
  req: NextRequest
): Promise<AuthContext | NextResponse> {
  const authHeader = req.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Missing authorization header' }, { status: 401 })
  }

  const token = authHeader.replace('Bearer ', '')
  const supabase = getAdminClient()

  const { data: { user }, error } = await supabase.auth.getUser(token)
  if (error || !user) {
    return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || !['editor', 'admin'].includes(profile.role)) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
  }

  return { userId: user.id, role: profile.role as 'editor' | 'admin' }
}

export function isAuthError(result: AuthContext | NextResponse): result is NextResponse {
  return result instanceof NextResponse
}
