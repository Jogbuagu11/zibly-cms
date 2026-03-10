'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import {
  ArrowLeft,
  Loader2,
  CheckCircle,
  XCircle,
  AlertCircle,
  ExternalLink,
  Volume2,
  Video,
  FileText,
  CheckCheck,
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

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface StoryVersion {
  id: string
  age_range: string
  rewritten_content: string
  status: string
  word_count: number
  audio_url: string | null
  audio_duration_s: number | null
  video_url: string | null
  reviewed_by: string | null
  reviewed_at: string | null
  created_at: string
}

interface RawStory {
  id: string
  title: string
  source_url: string | null
  source_name: string | null
}

interface Story {
  id: string
  title: string
  status: string
  source_url: string | null
  source_name: string | null
  raw_story_id: string | null
  story_versions: StoryVersion[]
}

const AGE_RANGES = ['7-10', '11-14', '14-17']

const VERSION_STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700',
  review: 'bg-amber-100 text-amber-700',
  approved: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
}

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

function ReviewSkeleton() {
  return (
    <div className="space-y-6">
      <div className="h-8 w-64 animate-pulse rounded bg-slate-200" />
      <div className="flex gap-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-10 w-24 animate-pulse rounded-lg bg-slate-200" />
        ))}
      </div>
      <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-6">
        <div className="h-4 w-3/4 animate-pulse rounded bg-slate-200" />
        <div className="h-32 w-full animate-pulse rounded-lg bg-slate-200" />
        <div className="h-12 w-full animate-pulse rounded-lg bg-slate-200" />
        <div className="h-48 w-full animate-pulse rounded-lg bg-slate-200" />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Review Page
// ---------------------------------------------------------------------------

export default function StoryReviewPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const [storyId, setStoryId] = useState<string | null>(null)
  const [story, setStory] = useState<Story | null>(null)
  const [rawStory, setRawStory] = useState<RawStory | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState<string>(AGE_RANGES[0])

  // Action states
  const [approvingRange, setApprovingRange] = useState<string | null>(null)
  const [rejectingRange, setRejectingRange] = useState<string | null>(null)
  const [approvingAll, setApprovingAll] = useState(false)
  const [actionMessage, setActionMessage] = useState('')
  const [actionError, setActionError] = useState('')

  // Resolve async params
  useEffect(() => {
    params.then((resolved) => setStoryId(resolved.id))
  }, [params])

  const fetchStory = useCallback(async () => {
    if (!storyId) return
    setLoading(true)
    setError('')
    try {
      const data = await apiFetch(`/api/stories/${storyId}`)
      setStory(data.story)

      // If there is a linked raw story, fetch source info
      if (data.story?.raw_story_id) {
        const { data: rawData } = await supabase
          .from('raw_stories')
          .select('id, title, source_url, source_name')
          .eq('id', data.story.raw_story_id)
          .single()
        if (rawData) setRawStory(rawData)
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load story')
    } finally {
      setLoading(false)
    }
  }, [storyId])

  useEffect(() => {
    fetchStory()
  }, [fetchStory])

  function getVersionForRange(ageRange: string): StoryVersion | undefined {
    return story?.story_versions?.find((v) => v.age_range === ageRange)
  }

  async function handleApprove(ageRange: string) {
    setApprovingRange(ageRange)
    setActionMessage('')
    setActionError('')
    try {
      await apiFetch(`/api/stories/${storyId}/approve`, {
        method: 'POST',
        body: JSON.stringify({ age_range: ageRange }),
      })
      setActionMessage(`Version ${ageRange} approved.`)
      await fetchStory()
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Approval failed')
    } finally {
      setApprovingRange(null)
    }
  }

  async function handleReject(ageRange: string) {
    setRejectingRange(ageRange)
    setActionMessage('')
    setActionError('')
    try {
      await apiFetch(`/api/stories/${storyId}/approve`, {
        method: 'POST',
        body: JSON.stringify({ age_range: ageRange, action: 'reject' }),
      })
      setActionMessage(`Version ${ageRange} rejected.`)
      await fetchStory()
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Rejection failed')
    } finally {
      setRejectingRange(null)
    }
  }

  async function handleApproveAll() {
    setApprovingAll(true)
    setActionMessage('')
    setActionError('')
    try {
      await apiFetch(`/api/stories/${storyId}/approve`, {
        method: 'POST',
        body: JSON.stringify({}),
      })
      setActionMessage('All versions approved.')
      await fetchStory()
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Approve all failed')
    } finally {
      setApprovingAll(false)
    }
  }

  // Source URL: prefer raw_story source, fall back to story source
  const sourceUrl = rawStory?.source_url ?? story?.source_url
  const sourceName = rawStory?.source_name ?? story?.source_name

  if (!storyId || loading) {
    return (
      <div className="space-y-6">
        <ReviewSkeleton />
      </div>
    )
  }

  if (error || !story) {
    return (
      <div className="space-y-4">
        <Link
          href="/stories"
          className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Stories
        </Link>
        <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {error || 'Story not found'}
        </div>
      </div>
    )
  }

  const currentVersion = getVersionForRange(activeTab)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <Link
            href={`/stories/${storyId}`}
            className="mt-1 rounded-md p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Review: {story.title}</h1>
            <p className="mt-1 text-sm text-slate-500">
              Review content for each age range before publishing.
            </p>
          </div>
        </div>
        <button
          onClick={handleApproveAll}
          disabled={approvingAll}
          className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-green-700 disabled:opacity-60"
        >
          {approvingAll ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <CheckCheck className="h-4 w-4" />
          )}
          Approve All
        </button>
      </div>

      {/* Source Attribution */}
      {sourceUrl && (
        <div className="rounded-xl border border-slate-200 bg-white px-5 py-3 shadow-sm">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-xs font-medium uppercase tracking-wider text-slate-500">
              Source
            </span>
            <a
              href={sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-700"
            >
              {sourceName || sourceUrl}
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </div>
      )}

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

      {/* Age Range Tabs */}
      <div className="flex gap-1 overflow-x-auto rounded-lg border border-slate-200 bg-slate-50 p-1">
        {AGE_RANGES.map((range) => {
          const version = getVersionForRange(range)
          return (
            <button
              key={range}
              onClick={() => setActiveTab(range)}
              className={`flex items-center gap-1.5 whitespace-nowrap rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === range
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Ages {range}
              {version && (
                <span
                  className={`ml-1 inline-flex rounded-full px-1.5 py-0.5 text-[10px] font-medium capitalize ${
                    VERSION_STATUS_COLORS[version.status] ?? 'bg-gray-100 text-gray-700'
                  }`}
                >
                  {version.status}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Tab Content */}
      {currentVersion ? (
        <div className="space-y-6">
          {/* Written Article */}
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-slate-400" />
                <h3 className="text-lg font-semibold text-slate-900">
                  Written Article
                </h3>
                <span className="text-xs text-slate-400">
                  {currentVersion.word_count} words
                </span>
              </div>
              <span
                className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${
                  VERSION_STATUS_COLORS[currentVersion.status] ?? 'bg-gray-100 text-gray-700'
                }`}
              >
                {currentVersion.status}
              </span>
            </div>
            <div className="max-h-96 overflow-y-auto whitespace-pre-wrap rounded-lg bg-slate-50 p-5 text-sm leading-relaxed text-slate-700">
              {currentVersion.rewritten_content || 'No content generated yet.'}
            </div>
          </div>

          {/* Audio Player */}
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-center gap-2">
              <Volume2 className="h-5 w-5 text-slate-400" />
              <h3 className="text-lg font-semibold text-slate-900">Audio</h3>
            </div>
            {currentVersion.audio_url ? (
              <div>
                <audio
                  controls
                  src={currentVersion.audio_url}
                  className="w-full"
                  preload="metadata"
                >
                  Your browser does not support the audio element.
                </audio>
                {currentVersion.audio_duration_s && (
                  <p className="mt-2 text-xs text-slate-400">
                    Duration: {Math.floor(currentVersion.audio_duration_s / 60)}:
                    {String(Math.round(currentVersion.audio_duration_s % 60)).padStart(2, '0')}
                  </p>
                )}
              </div>
            ) : (
              <p className="text-sm text-slate-400">No audio generated yet.</p>
            )}
          </div>

          {/* Video Player */}
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-center gap-2">
              <Video className="h-5 w-5 text-slate-400" />
              <h3 className="text-lg font-semibold text-slate-900">Video</h3>
            </div>
            {currentVersion.video_url ? (
              <div className="overflow-hidden rounded-lg bg-black">
                <video
                  controls
                  src={currentVersion.video_url}
                  className="w-full"
                  preload="metadata"
                >
                  Your browser does not support the video element.
                </video>
              </div>
            ) : (
              <p className="text-sm text-slate-400">No video generated yet.</p>
            )}
          </div>

          {/* Approve / Reject Buttons */}
          <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-6 py-4 shadow-sm">
            <button
              onClick={() => handleApprove(activeTab)}
              disabled={
                approvingRange === activeTab || currentVersion.status === 'approved'
              }
              className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-green-700 disabled:opacity-60"
            >
              {approvingRange === activeTab ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle className="h-4 w-4" />
              )}
              Approve Ages {activeTab}
            </button>
            <button
              onClick={() => handleReject(activeTab)}
              disabled={
                rejectingRange === activeTab || currentVersion.status === 'rejected'
              }
              className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-700 shadow-sm transition-colors hover:bg-red-100 disabled:opacity-60"
            >
              {rejectingRange === activeTab ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <XCircle className="h-4 w-4" />
              )}
              Reject Ages {activeTab}
            </button>
            {currentVersion.status === 'approved' && (
              <span className="inline-flex items-center gap-1.5 text-sm font-medium text-green-600">
                <CheckCircle className="h-4 w-4" />
                Approved
              </span>
            )}
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-xl border border-slate-200 bg-white py-16 shadow-sm">
          <FileText className="mb-3 h-10 w-10 text-slate-300" />
          <p className="text-sm font-medium text-slate-500">
            No version for Ages {activeTab}
          </p>
          <p className="mt-1 text-xs text-slate-400">
            This version has not been generated yet.
          </p>
        </div>
      )}
    </div>
  )
}
