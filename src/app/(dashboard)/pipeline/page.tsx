'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import {
  Play,
  Zap,
  RefreshCw,
  Loader2,
  AlertCircle,
  CheckCircle,
  Clock,
  Inbox,
  ExternalLink,
  Filter,
} from 'lucide-react'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function apiFetch(path: string, options: RequestInit = {}) {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token ?? ''
  const res = await fetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error || `Error ${res.status}`)
  }
  return res.json()
}

function timeAgo(dateString: string): string {
  const seconds = Math.floor(
    (Date.now() - new Date(dateString).getTime()) / 1000,
  )
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PipelineRun {
  id: string
  status: string
  current_step: string | null
  started_at: string
  completed_at: string | null
  error_message: string | null
  created_at: string
}

interface RawStory {
  id: string
  title: string
  source_url: string | null
  source_name: string | null
  status: string
  created_at: string
}

type RawStoryStatus = 'all' | 'new' | 'processing' | 'done' | 'skipped'

// ---------------------------------------------------------------------------
// Skeleton Loaders
// ---------------------------------------------------------------------------

function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="divide-y divide-slate-100">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 px-6 py-4">
          <div className="h-4 w-48 animate-pulse rounded bg-slate-200" />
          <div className="h-5 w-20 animate-pulse rounded-full bg-slate-200" />
          <div className="ml-auto h-4 w-24 animate-pulse rounded bg-slate-200" />
          <div className="h-4 w-20 animate-pulse rounded bg-slate-200" />
        </div>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Status badges
// ---------------------------------------------------------------------------

const RUN_STATUS_COLORS: Record<string, string> = {
  running: 'bg-blue-100 text-blue-700',
  completed: 'bg-green-100 text-green-700',
  failed: 'bg-red-100 text-red-700',
  pending: 'bg-amber-100 text-amber-700',
}

const STORY_STATUS_COLORS: Record<string, string> = {
  new: 'bg-blue-100 text-blue-700',
  processing: 'bg-amber-100 text-amber-700',
  done: 'bg-green-100 text-green-700',
  skipped: 'bg-gray-100 text-gray-700',
}

// ---------------------------------------------------------------------------
// Pipeline Page
// ---------------------------------------------------------------------------

export default function PipelinePage() {
  const [runs, setRuns] = useState<PipelineRun[]>([])
  const [stories, setStories] = useState<RawStory[]>([])
  const [statusFilter, setStatusFilter] = useState<RawStoryStatus>('all')
  const [loadingRuns, setLoadingRuns] = useState(true)
  const [loadingStories, setLoadingStories] = useState(true)
  const [error, setError] = useState('')

  // Action states
  const [ingesting, setIngesting] = useState(false)
  const [processingAll, setProcessingAll] = useState(false)
  const [processingStoryId, setProcessingStoryId] = useState<string | null>(null)
  const [actionMessage, setActionMessage] = useState('')
  const [actionError, setActionError] = useState('')

  const fetchRuns = useCallback(async () => {
    setLoadingRuns(true)
    try {
      const { data, error: err } = await supabase
        .from('pipeline_runs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20)

      if (err) throw new Error(err.message)
      setRuns(data ?? [])
    } catch (err: unknown) {
      console.error('Failed to fetch pipeline runs:', err)
    } finally {
      setLoadingRuns(false)
    }
  }, [])

  const fetchStories = useCallback(async () => {
    setLoadingStories(true)
    try {
      let query = supabase
        .from('raw_stories')
        .select('id, title, source_url, source_name, status, created_at')
        .order('created_at', { ascending: false })
        .limit(50)

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter)
      }

      const { data, error: err } = await query
      if (err) throw new Error(err.message)
      setStories(data ?? [])
    } catch (err: unknown) {
      console.error('Failed to fetch raw stories:', err)
    } finally {
      setLoadingStories(false)
    }
  }, [statusFilter])

  useEffect(() => {
    fetchRuns()
  }, [fetchRuns])

  useEffect(() => {
    fetchStories()
  }, [fetchStories])

  // Actions
  async function handleIngest() {
    setIngesting(true)
    setActionMessage('')
    setActionError('')
    try {
      const data = await apiFetch('/api/pipeline/ingest', { method: 'POST' })
      setActionMessage(data.message ?? 'Ingestion started successfully.')
      await fetchRuns()
      await fetchStories()
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Ingestion failed')
    } finally {
      setIngesting(false)
    }
  }

  async function handleProcessAll() {
    setProcessingAll(true)
    setActionMessage('')
    setActionError('')
    try {
      const data = await apiFetch('/api/pipeline/process-all', { method: 'POST' })
      setActionMessage(data.message ?? 'Processing started for all new stories.')
      await fetchRuns()
      await fetchStories()
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Process all failed')
    } finally {
      setProcessingAll(false)
    }
  }

  async function handleProcessSingle(storyId: string) {
    setProcessingStoryId(storyId)
    setActionMessage('')
    setActionError('')
    try {
      const data = await apiFetch('/api/pipeline/process', {
        method: 'POST',
        body: JSON.stringify({ story_id: storyId }),
      })
      setActionMessage(data.message ?? 'Pipeline triggered for story.')
      await fetchRuns()
      await fetchStories()
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Process failed')
    } finally {
      setProcessingStoryId(null)
    }
  }

  async function handleRefresh() {
    setError('')
    await Promise.all([fetchRuns(), fetchStories()])
  }

  const STATUS_TABS: { label: string; value: RawStoryStatus }[] = [
    { label: 'All', value: 'all' },
    { label: 'New', value: 'new' },
    { label: 'Processing', value: 'processing' },
    { label: 'Done', value: 'done' },
    { label: 'Skipped', value: 'skipped' },
  ]

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Content Pipeline</h1>
          <p className="mt-1 text-sm text-gray-500">
            Ingest raw stories and process them through the content pipeline.
          </p>
        </div>
        <button
          onClick={handleRefresh}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </button>
      </div>

      {/* Action Messages */}
      {actionMessage && (
        <div className="flex items-center gap-2 rounded-lg bg-green-50 px-4 py-3 text-sm text-green-700">
          <CheckCircle className="h-4 w-4 flex-shrink-0" />
          {actionMessage}
        </div>
      )}
      {actionError && (
        <div className="flex items-center gap-2 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          {actionError}
        </div>
      )}
      {error && (
        <div className="flex items-center gap-2 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-3">
        <button
          onClick={handleIngest}
          disabled={ingesting}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 disabled:opacity-60"
        >
          {ingesting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Play className="h-4 w-4" />
          )}
          Run Ingestion
        </button>
        <button
          onClick={handleProcessAll}
          disabled={processingAll}
          className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-green-700 disabled:opacity-60"
        >
          {processingAll ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Zap className="h-4 w-4" />
          )}
          Process All New
        </button>
      </div>

      {/* Pipeline Runs Table */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold text-gray-900">Recent Pipeline Runs</h2>
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          {loadingRuns ? (
            <TableSkeleton rows={4} />
          ) : runs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-500">
              <Inbox className="mb-3 h-10 w-10 text-slate-300" />
              <p className="text-sm font-medium">No pipeline runs yet</p>
              <p className="mt-1 text-xs text-slate-400">
                Click &quot;Run Ingestion&quot; to start.
              </p>
            </div>
          ) : (
            <>
              <div className="hidden border-b border-slate-200 bg-slate-50 px-6 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500 md:grid md:grid-cols-12 md:gap-4">
                <div className="col-span-2">Status</div>
                <div className="col-span-3">Current Step</div>
                <div className="col-span-2">Started</div>
                <div className="col-span-2">Completed</div>
                <div className="col-span-3">Error</div>
              </div>
              <div className="divide-y divide-slate-100">
                {runs.map((run) => (
                  <div
                    key={run.id}
                    className="grid grid-cols-1 gap-2 px-6 py-4 transition-colors hover:bg-slate-50 md:grid-cols-12 md:items-center md:gap-4"
                  >
                    <div className="col-span-2">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${
                          RUN_STATUS_COLORS[run.status] ?? 'bg-gray-100 text-gray-700'
                        }`}
                      >
                        {run.status}
                      </span>
                    </div>
                    <div className="col-span-3 text-sm text-slate-700">
                      {run.current_step ?? '--'}
                    </div>
                    <div className="col-span-2 text-xs text-slate-500">
                      {run.started_at ? timeAgo(run.started_at) : '--'}
                    </div>
                    <div className="col-span-2 text-xs text-slate-500">
                      {run.completed_at ? timeAgo(run.completed_at) : '--'}
                    </div>
                    <div className="col-span-3 truncate text-xs text-red-500">
                      {run.error_message ?? ''}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Raw Stories Table */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Raw Stories</h2>
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Filter className="h-4 w-4" />
            <span>Filter:</span>
          </div>
        </div>

        {/* Status Filter Tabs */}
        <div className="flex flex-wrap gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setStatusFilter(tab.value)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                statusFilter === tab.value
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          {loadingStories ? (
            <TableSkeleton rows={5} />
          ) : stories.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-500">
              <Inbox className="mb-3 h-10 w-10 text-slate-300" />
              <p className="text-sm font-medium">No raw stories found</p>
              <p className="mt-1 text-xs text-slate-400">
                {statusFilter !== 'all'
                  ? 'Try a different filter'
                  : 'Run ingestion to fetch new stories.'}
              </p>
            </div>
          ) : (
            <>
              <div className="hidden border-b border-slate-200 bg-slate-50 px-6 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500 md:grid md:grid-cols-12 md:gap-4">
                <div className="col-span-4">Title</div>
                <div className="col-span-2">Source</div>
                <div className="col-span-2">Status</div>
                <div className="col-span-2">Created</div>
                <div className="col-span-2 text-right">Actions</div>
              </div>
              <div className="divide-y divide-slate-100">
                {stories.map((story) => (
                  <div
                    key={story.id}
                    className="grid grid-cols-1 gap-2 px-6 py-4 transition-colors hover:bg-slate-50 md:grid-cols-12 md:items-center md:gap-4"
                  >
                    <div className="col-span-4">
                      <p className="truncate text-sm font-medium text-slate-900">
                        {story.title}
                      </p>
                    </div>
                    <div className="col-span-2">
                      {story.source_url ? (
                        <a
                          href={story.source_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700"
                        >
                          {story.source_name || 'Source'}
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      ) : (
                        <span className="text-xs text-slate-400">
                          {story.source_name || '--'}
                        </span>
                      )}
                    </div>
                    <div className="col-span-2">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${
                          STORY_STATUS_COLORS[story.status] ?? 'bg-gray-100 text-gray-700'
                        }`}
                      >
                        {story.status}
                      </span>
                    </div>
                    <div className="col-span-2 text-xs text-slate-500">
                      {timeAgo(story.created_at)}
                    </div>
                    <div className="col-span-2 flex justify-end">
                      {story.status === 'new' && (
                        <button
                          onClick={() => handleProcessSingle(story.id)}
                          disabled={processingStoryId === story.id}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700 transition-colors hover:bg-blue-100 disabled:opacity-60"
                        >
                          {processingStoryId === story.id ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <Play className="h-3 w-3" />
                          )}
                          Process
                        </button>
                      )}
                      {story.status === 'processing' && (
                        <span className="inline-flex items-center gap-1.5 text-xs text-amber-600">
                          <Clock className="h-3 w-3" />
                          Processing
                        </span>
                      )}
                      {story.status === 'done' && (
                        <span className="inline-flex items-center gap-1.5 text-xs text-green-600">
                          <CheckCircle className="h-3 w-3" />
                          Done
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
