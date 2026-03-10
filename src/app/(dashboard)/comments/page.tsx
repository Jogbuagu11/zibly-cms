'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { apiFetch } from '@/lib/api'
import { useAuth } from '@/components/AuthProvider'
import {
  MessageSquare,
  Check,
  X,
  Trash2,
  Shield,
  ChevronLeft,
  ChevronRight,
  Inbox,
  Loader2,
  AlertCircle,
} from 'lucide-react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Comment {
  id: string
  body: string
  status: 'pending' | 'approved' | 'rejected'
  requires_parent_approval: boolean
  rejection_reason?: string
  created_at: string
  author_name: string
  author_role: 'child' | 'parent'
  story_id: string
  story_title: string
}

type TabKey = 'pending' | 'approved' | 'rejected'

const TABS: { key: TabKey; label: string }[] = [
  { key: 'pending', label: 'Pending' },
  { key: 'approved', label: 'Approved' },
  { key: 'rejected', label: 'Rejected' },
]

const PAGE_SIZE = 20

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function timeAgo(dateString: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateString).getTime()) / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

function roleBadge(role: string) {
  const colors = role === 'child' ? 'bg-sky-100 text-sky-700' : 'bg-green-100 text-green-700'
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${colors}`}>
      {role}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Skeletons
// ---------------------------------------------------------------------------

function CommentSkeleton() {
  return (
    <div className="animate-pulse space-y-3 py-5">
      <div className="flex items-center gap-2">
        <div className="h-4 w-24 rounded bg-slate-200" />
        <div className="h-5 w-12 rounded-full bg-slate-200" />
      </div>
      <div className="h-4 w-3/4 rounded bg-slate-200" />
      <div className="h-3 w-1/3 rounded bg-slate-200" />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Reject Modal
// ---------------------------------------------------------------------------

function RejectModal({
  onConfirm,
  onCancel,
}: {
  onConfirm: (reason: string) => void
  onCancel: () => void
}) {
  const [reason, setReason] = useState('')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-lg">
        <h3 className="text-lg font-semibold text-slate-900">Reject Comment</h3>
        <p className="mt-1 text-sm text-slate-500">
          Please provide a reason for rejecting this comment.
        </p>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={3}
          className="mt-4 block w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm placeholder-slate-400 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          placeholder="Reason for rejection..."
        />
        <div className="mt-4 flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="rounded-lg px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100"
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(reason)}
            disabled={!reason.trim()}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Reject
          </button>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Delete Confirm Dialog
// ---------------------------------------------------------------------------

function DeleteDialog({
  onConfirm,
  onCancel,
}: {
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-6 shadow-lg">
        <h3 className="text-lg font-semibold text-slate-900">Delete Comment</h3>
        <p className="mt-1 text-sm text-slate-500">
          Are you sure you want to permanently delete this comment? This action cannot be undone.
        </p>
        <div className="mt-4 flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="rounded-lg px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function CommentsPage() {
  const { user } = useAuth()
  const [tab, setTab] = useState<TabKey>('pending')
  const [comments, setComments] = useState<Comment[]>([])
  const [counts, setCounts] = useState<Record<TabKey, number>>({ pending: 0, approved: 0, rejected: 0 })
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  // Modal states
  const [rejectTarget, setRejectTarget] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)

  // Fetch comments
  const fetchComments = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      // Fetch counts for all tabs
      const countPromises = TABS.map(async (t) => {
        const { count } = await supabase
          .from('comments')
          .select('*', { count: 'exact', head: true })
          .eq('status', t.key)
        return { key: t.key, count: count ?? 0 }
      })

      const countResults = await Promise.all(countPromises)
      const newCounts = {} as Record<TabKey, number>
      countResults.forEach((c) => { newCounts[c.key] = c.count })
      setCounts(newCounts)

      // Fetch page of comments
      const from = (page - 1) * PAGE_SIZE
      const to = from + PAGE_SIZE - 1

      const { data, count } = await supabase
        .from('comments')
        .select('id, body, status, requires_parent_approval, rejection_reason, created_at, author_name, author_role, story_id, story_title', { count: 'exact' })
        .eq('status', tab)
        .order('created_at', { ascending: false })
        .range(from, to)

      setComments((data as Comment[]) ?? [])
      setTotalPages(Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE)))
    } catch (err) {
      console.error('Failed to load comments:', err)
      setError('Unable to load comments. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [tab, page])

  useEffect(() => {
    fetchComments()
  }, [fetchComments])

  // Reset page when tab changes
  useEffect(() => {
    setPage(1)
  }, [tab])

  // Actions
  async function handleApprove(commentId: string) {
    setActionLoading(commentId)
    try {
      await supabase
        .from('comments')
        .update({
          status: 'approved',
          moderated_by: user?.id,
          moderated_at: new Date().toISOString(),
        })
        .eq('id', commentId)
      await fetchComments()
    } catch (err) {
      console.error('Failed to approve comment:', err)
    } finally {
      setActionLoading(null)
    }
  }

  async function handleReject(commentId: string, reason: string) {
    setActionLoading(commentId)
    setRejectTarget(null)
    try {
      await supabase
        .from('comments')
        .update({
          status: 'rejected',
          rejection_reason: reason,
          moderated_by: user?.id,
          moderated_at: new Date().toISOString(),
        })
        .eq('id', commentId)
      await fetchComments()
    } catch (err) {
      console.error('Failed to reject comment:', err)
    } finally {
      setActionLoading(null)
    }
  }

  async function handleDelete(commentId: string) {
    setActionLoading(commentId)
    setDeleteTarget(null)
    try {
      await apiFetch(`/api/comments/${commentId}`, { method: 'DELETE' })
      await fetchComments()
    } catch (err) {
      console.error('Failed to delete comment:', err)
    } finally {
      setActionLoading(null)
    }
  }

  // ---- Error state ----------------------------------------------------------
  if (error && !loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-center">
          <AlertCircle className="h-10 w-10 text-red-400" />
          <p className="text-slate-600">{error}</p>
          <button
            onClick={() => fetchComments()}
            className="mt-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Comment Moderation</h1>
        <p className="mt-1 text-sm text-slate-500">
          Review, approve, or reject user comments.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              tab === t.key
                ? 'bg-blue-600 text-white'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            {t.label}
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                tab === t.key ? 'bg-blue-500 text-white' : 'bg-slate-100 text-slate-600'
              }`}
            >
              {counts[t.key]}
            </span>
          </button>
        ))}
      </div>

      {/* Comments list */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
        {loading ? (
          <div className="divide-y divide-slate-100 px-6">
            {Array.from({ length: 5 }).map((_, i) => (
              <CommentSkeleton key={i} />
            ))}
          </div>
        ) : comments.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <Inbox className="h-10 w-10 text-slate-300" />
            <p className="text-sm text-slate-400">
              No {tab} comments to show.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {comments.map((comment) => (
              <div key={comment.id} className="flex items-start justify-between gap-4 px-6 py-5">
                <div className="min-w-0 flex-1">
                  {/* Author row */}
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-slate-900">
                      {comment.author_name}
                    </span>
                    {roleBadge(comment.author_role)}
                    {comment.requires_parent_approval && (
                      <span className="flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-700">
                        <Shield className="h-3 w-3" />
                        COPPA
                      </span>
                    )}
                  </div>

                  {/* Comment body */}
                  <p className="mt-1.5 text-sm text-slate-700">{comment.body}</p>

                  {/* Meta */}
                  <p className="mt-1.5 text-xs text-slate-400">
                    on{' '}
                    <span className="font-medium text-slate-500">{comment.story_title}</span>
                    <span className="mx-1.5 text-slate-300">&middot;</span>
                    {timeAgo(comment.created_at)}
                  </p>

                  {/* Rejection reason if rejected */}
                  {comment.status === 'rejected' && comment.rejection_reason && (
                    <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">
                      <span className="font-medium">Reason:</span> {comment.rejection_reason}
                    </p>
                  )}
                </div>

                {/* Actions */}
                <div className="flex shrink-0 items-center gap-2">
                  {actionLoading === comment.id ? (
                    <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
                  ) : (
                    <>
                      {comment.status !== 'approved' && (
                        <button
                          onClick={() => handleApprove(comment.id)}
                          title="Approve"
                          className="rounded-lg p-2 text-green-600 transition-colors hover:bg-green-50"
                        >
                          <Check className="h-4 w-4" />
                        </button>
                      )}
                      {comment.status !== 'rejected' && (
                        <button
                          onClick={() => setRejectTarget(comment.id)}
                          title="Reject"
                          className="rounded-lg p-2 text-red-600 transition-colors hover:bg-red-50"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      )}
                      <button
                        onClick={() => setDeleteTarget(comment.id)}
                        title="Delete"
                        className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-50 hover:text-slate-600"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {!loading && totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-slate-100 px-6 py-4">
            <p className="text-sm text-slate-500">
              Page {page} of {totalPages}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Reject Modal */}
      {rejectTarget && (
        <RejectModal
          onConfirm={(reason) => handleReject(rejectTarget, reason)}
          onCancel={() => setRejectTarget(null)}
        />
      )}

      {/* Delete Dialog */}
      {deleteTarget && (
        <DeleteDialog
          onConfirm={() => handleDelete(deleteTarget)}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  )
}
