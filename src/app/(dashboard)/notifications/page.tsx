'use client'

import { useState, useEffect, useCallback, FormEvent } from 'react'
import { supabase } from '@/lib/supabase'
import { apiFetch } from '@/lib/api'
import {
  Bell,
  Send,
  Loader2,
  AlertCircle,
  Inbox,
  CheckCircle2,
} from 'lucide-react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type NotificationType = 'breaking_news' | 'new_story' | 'parent_approval_request' | 'weekly_summary'

interface NotificationLog {
  id: string
  type: NotificationType
  title: string
  body: string
  created_at: string
  target_count: number
}

const NOTIFICATION_TYPES: { value: NotificationType; label: string }[] = [
  { value: 'breaking_news', label: 'Breaking News' },
  { value: 'new_story', label: 'New Story' },
  { value: 'parent_approval_request', label: 'Parent Approval Request' },
  { value: 'weekly_summary', label: 'Weekly Summary' },
]

const AGE_RANGES = [
  { value: 'all', label: 'All Ages' },
  { value: '7-10', label: '7-10' },
  { value: '11-14', label: '11-14' },
  { value: '15-17', label: '15-17' },
]

const TYPE_COLORS: Record<string, string> = {
  breaking_news: 'bg-red-100 text-red-700',
  new_story: 'bg-blue-100 text-blue-700',
  parent_approval_request: 'bg-amber-100 text-amber-700',
  weekly_summary: 'bg-purple-100 text-purple-700',
}

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

function formatTypeLabel(type: string): string {
  return type.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function NotificationsPage() {
  // Form state
  const [type, setType] = useState<NotificationType>('breaking_news')
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [storyId, setStoryId] = useState('')
  const [ageRange, setAgeRange] = useState('all')
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)
  const [sendSuccess, setSendSuccess] = useState(false)

  // Log state
  const [logs, setLogs] = useState<NotificationLog[]>([])
  const [logsLoading, setLogsLoading] = useState(true)
  const [logsError, setLogsError] = useState<string | null>(null)

  // Fetch recent notifications
  const fetchLogs = useCallback(async () => {
    try {
      setLogsLoading(true)
      setLogsError(null)

      const { data, error } = await supabase
        .from('notifications')
        .select('id, type, title, body, created_at, target_count')
        .order('created_at', { ascending: false })
        .limit(20)

      if (error) throw error
      setLogs((data as NotificationLog[]) ?? [])
    } catch (err) {
      console.error('Failed to load notification logs:', err)
      setLogsError('Unable to load notification history.')
    } finally {
      setLogsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchLogs()
  }, [fetchLogs])

  // Send notification
  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSending(true)
    setSendError(null)
    setSendSuccess(false)

    try {
      const payload: Record<string, string> = { type, title, body }
      if (storyId.trim()) payload.story_id = storyId.trim()
      if (ageRange !== 'all') payload.age_range = ageRange

      await apiFetch('/api/notifications', {
        method: 'POST',
        body: JSON.stringify(payload),
      })

      setSendSuccess(true)
      setTitle('')
      setBody('')
      setStoryId('')
      setAgeRange('all')

      // Refresh log
      await fetchLogs()

      // Clear success after 4s
      setTimeout(() => setSendSuccess(false), 4000)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to send notification'
      setSendError(message)
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Push Notifications</h1>
        <p className="mt-1 text-sm text-slate-500">
          Send push notifications to users and view recent history.
        </p>
      </div>

      {/* Send Notification Form */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Send Notification</h2>
        <p className="mt-1 text-sm text-slate-500">
          Compose and send a push notification to targeted users.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-5">
          {/* Error / Success */}
          {sendError && (
            <div className="flex items-center gap-2 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {sendError}
            </div>
          )}
          {sendSuccess && (
            <div className="flex items-center gap-2 rounded-lg bg-green-50 px-4 py-3 text-sm text-green-700">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              Notification sent successfully!
            </div>
          )}

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            {/* Type */}
            <div>
              <label htmlFor="notif-type" className="mb-1.5 block text-sm font-medium text-slate-700">
                Type
              </label>
              <select
                id="notif-type"
                value={type}
                onChange={(e) => setType(e.target.value as NotificationType)}
                className="block w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              >
                {NOTIFICATION_TYPES.map((nt) => (
                  <option key={nt.value} value={nt.value}>{nt.label}</option>
                ))}
              </select>
            </div>

            {/* Age Range */}
            <div>
              <label htmlFor="age-range" className="mb-1.5 block text-sm font-medium text-slate-700">
                Age Range <span className="text-slate-400">(optional)</span>
              </label>
              <select
                id="age-range"
                value={ageRange}
                onChange={(e) => setAgeRange(e.target.value)}
                className="block w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              >
                {AGE_RANGES.map((ar) => (
                  <option key={ar.value} value={ar.value}>{ar.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Title */}
          <div>
            <label htmlFor="notif-title" className="mb-1.5 block text-sm font-medium text-slate-700">
              Title
            </label>
            <input
              id="notif-title"
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="block w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm placeholder-slate-400 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              placeholder="Notification title"
            />
          </div>

          {/* Body */}
          <div>
            <label htmlFor="notif-body" className="mb-1.5 block text-sm font-medium text-slate-700">
              Body
            </label>
            <textarea
              id="notif-body"
              required
              rows={3}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className="block w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm placeholder-slate-400 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              placeholder="Notification body text..."
            />
          </div>

          {/* Story ID */}
          <div>
            <label htmlFor="story-id" className="mb-1.5 block text-sm font-medium text-slate-700">
              Story ID <span className="text-slate-400">(optional)</span>
            </label>
            <input
              id="story-id"
              type="text"
              value={storyId}
              onChange={(e) => setStoryId(e.target.value)}
              className="block w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm placeholder-slate-400 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              placeholder="e.g. abc123-def456"
            />
          </div>

          {/* Submit */}
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={sending}
              className="flex items-center gap-2 rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {sending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              Send Notification
            </button>
          </div>
        </form>
      </div>

      {/* Recent Notifications Log */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-6 py-4">
          <h2 className="font-semibold text-slate-900">Recent Notifications</h2>
          <p className="mt-0.5 text-xs text-slate-500">Last 20 sent notifications</p>
        </div>

        {logsLoading ? (
          <div className="divide-y divide-slate-100 px-6">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="animate-pulse space-y-2 py-4">
                <div className="flex items-center gap-2">
                  <div className="h-5 w-20 rounded-full bg-slate-200" />
                  <div className="h-4 w-40 rounded bg-slate-200" />
                </div>
                <div className="h-3 w-3/4 rounded bg-slate-200" />
              </div>
            ))}
          </div>
        ) : logsError ? (
          <div className="flex flex-col items-center gap-3 py-12 text-center">
            <AlertCircle className="h-8 w-8 text-red-400" />
            <p className="text-sm text-slate-500">{logsError}</p>
            <button
              onClick={fetchLogs}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
            >
              Retry
            </button>
          </div>
        ) : logs.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <Inbox className="h-10 w-10 text-slate-300" />
            <p className="text-sm text-slate-400">No notifications have been sent yet.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {logs.map((log) => (
              <div key={log.id} className="px-6 py-4">
                <div className="flex items-center gap-3">
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${TYPE_COLORS[log.type] ?? 'bg-slate-100 text-slate-700'}`}>
                    {formatTypeLabel(log.type)}
                  </span>
                  <h3 className="text-sm font-medium text-slate-900">{log.title}</h3>
                </div>
                <p className="mt-1 text-sm text-slate-600">{log.body}</p>
                <div className="mt-2 flex items-center gap-3 text-xs text-slate-400">
                  <span>{timeAgo(log.created_at)}</span>
                  {log.target_count != null && (
                    <>
                      <span className="text-slate-300">&middot;</span>
                      <span className="flex items-center gap-1">
                        <Bell className="h-3 w-3" />
                        {log.target_count} recipients
                      </span>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
