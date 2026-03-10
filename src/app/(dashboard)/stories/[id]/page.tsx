'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import {
  ArrowLeft,
  Loader2,
  CheckCircle,
  Send,
  Pencil,
  Image as ImageIcon,
  Map,
  MessageSquare,
  FileText,
  Layers,
  ExternalLink,
  Eye,
  Heart,
  Clock,
  AlertCircle,
} from 'lucide-react'

async function apiFetch(path: string, options: RequestInit = {}) {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token ?? ''
  const res = await fetch(path, {
    ...options,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...options.headers },
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error || `Error ${res.status}`)
  }
  return res.json()
}

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700',
  review: 'bg-amber-100 text-amber-700',
  approved: 'bg-blue-100 text-blue-700',
  published: 'bg-green-100 text-green-700',
  archived: 'bg-red-100 text-red-700',
}

type Tab = 'overview' | 'versions' | 'photos' | 'map' | 'comments'

const TABS: { label: string; value: Tab; icon: React.ElementType }[] = [
  { label: 'Overview', value: 'overview', icon: FileText },
  { label: 'Versions', value: 'versions', icon: Layers },
  { label: 'Photos', value: 'photos', icon: ImageIcon },
  { label: 'Map', value: 'map', icon: Map },
  { label: 'Comments', value: 'comments', icon: MessageSquare },
]

interface StoryVersion {
  id: string
  age_range: string
  rewritten_content: string
  status: string
  word_count: number
  audio_url: string | null
  audio_duration_s: number | null
  reviewed_by: string | null
  reviewed_at: string | null
  created_at: string
  updated_at: string
}

interface StoryPhoto {
  id: string
  url: string
  alt_text: string | null
  photographer: string | null
  photographer_url: string | null
  unsplash_id: string | null
  width: number
  height: number
}

interface StoryMap {
  id: string
  center_lat: number
  center_lng: number
  zoom: number
  geojson: unknown
}

interface Story {
  id: string
  title: string
  slug: string
  summary: string
  master_content: string
  status: string
  is_breaking: boolean
  cover_image_url: string | null
  source_url: string | null
  source_name: string | null
  view_count: number
  like_count: number
  published_at: string | null
  created_at: string
  updated_at: string
  versions_generated: boolean
  audio_generated: boolean
  map_fetched: boolean
  photos_fetched: boolean
  categories: { id: string; name: string; slug: string; color: string } | null
  users: { id: string; display_name: string; email: string; avatar_url: string | null } | null
  story_versions: StoryVersion[]
  story_photos: StoryPhoto[]
  story_maps: StoryMap[]
}

interface ModerationNote {
  id: string
  note: string
  created_at: string
  users: { display_name: string } | null
}

export default function StoryDetailPage() {
  const params = useParams()
  const router = useRouter()
  const storyId = params.id as string

  const [story, setStory] = useState<Story | null>(null)
  const [notes, setNotes] = useState<ModerationNote[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState<Tab>('overview')

  // Action states
  const [approving, setApproving] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [sendNotifications, setSendNotifications] = useState(true)
  const [actionMessage, setActionMessage] = useState('')
  const [actionError, setActionError] = useState('')

  // Version edit states
  const [editingVersions, setEditingVersions] = useState<Record<string, string>>({})
  const [savingVersion, setSavingVersion] = useState<string | null>(null)
  const [approvingVersion, setApprovingVersion] = useState<string | null>(null)

  // Editing mode
  const [editMode, setEditMode] = useState(false)

  const fetchStory = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const data = await apiFetch(`/api/stories/${storyId}`)
      setStory(data.story)
      setNotes(data.notes ?? [])
      // Initialize editing versions
      const vEdits: Record<string, string> = {}
      for (const v of data.story.story_versions ?? []) {
        vEdits[v.age_range] = v.rewritten_content ?? ''
      }
      setEditingVersions(vEdits)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load story')
    } finally {
      setLoading(false)
    }
  }, [storyId])

  useEffect(() => {
    fetchStory()
  }, [fetchStory])

  async function handleApprove(ageRange?: string) {
    if (ageRange) {
      setApprovingVersion(ageRange)
    } else {
      setApproving(true)
    }
    setActionError('')
    setActionMessage('')
    try {
      const payload: Record<string, unknown> = {}
      if (ageRange) payload.age_range = ageRange
      await apiFetch(`/api/stories/${storyId}/approve`, {
        method: 'POST',
        body: JSON.stringify(payload),
      })
      setActionMessage(ageRange ? `Version ${ageRange} approved.` : 'Story approved.')
      await fetchStory()
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Approval failed')
    } finally {
      setApproving(false)
      setApprovingVersion(null)
    }
  }

  async function handlePublish() {
    setPublishing(true)
    setActionError('')
    setActionMessage('')
    try {
      await apiFetch(`/api/stories/${storyId}/publish`, {
        method: 'POST',
        body: JSON.stringify({ send_notifications: sendNotifications }),
      })
      setActionMessage('Story published successfully.')
      await fetchStory()
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Publish failed')
    } finally {
      setPublishing(false)
    }
  }

  async function handleSaveVersion(ageRange: string) {
    setSavingVersion(ageRange)
    setActionError('')
    setActionMessage('')
    try {
      await apiFetch(`/api/stories/${storyId}/versions`, {
        method: 'PATCH',
        body: JSON.stringify({
          age_range: ageRange,
          rewritten_content: editingVersions[ageRange],
        }),
      })
      setActionMessage(`Version ${ageRange} saved.`)
      await fetchStory()
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSavingVersion(null)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <Link
            href="/stories"
            className="mt-1 rounded-md p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-slate-900">{story.title}</h1>
              <span
                className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${
                  STATUS_COLORS[story.status] ?? 'bg-gray-100 text-gray-700'
                }`}
              >
                {story.status}
              </span>
              {story.is_breaking && (
                <span className="inline-flex rounded bg-red-500 px-1.5 py-0.5 text-[10px] font-bold uppercase text-white">
                  Breaking
                </span>
              )}
            </div>
            <p className="mt-1 text-sm text-slate-500">
              By {story.users?.display_name ?? 'Unknown'} &middot;{' '}
              {new Date(story.created_at).toLocaleDateString()}
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {story.status === 'review' && (
            <>
              <button
                onClick={() => setEditMode(!editMode)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50"
              >
                <Pencil className="h-4 w-4" />
                {editMode ? 'View Mode' : 'Edit'}
              </button>
              <button
                onClick={() => handleApprove()}
                disabled={approving}
                className="inline-flex items-center gap-1.5 rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-green-700 disabled:opacity-60"
              >
                {approving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle className="h-4 w-4" />
                )}
                Approve
              </button>
            </>
          )}
          {story.status === 'approved' && (
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-sm text-slate-600">
                <input
                  type="checkbox"
                  checked={sendNotifications}
                  onChange={(e) => setSendNotifications(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500/20"
                />
                Send notifications
              </label>
              <button
                onClick={handlePublish}
                disabled={publishing}
                className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 disabled:opacity-60"
              >
                {publishing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                Publish
              </button>
            </div>
          )}
          {story.status === 'published' && (
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-green-50 px-4 py-2 text-sm font-semibold text-green-700">
              <CheckCircle className="h-4 w-4" />
              Published
            </span>
          )}
        </div>
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

      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto rounded-lg border border-slate-200 bg-slate-50 p-1">
        {TABS.map((tab) => {
          const Icon = tab.icon
          return (
            <button
              key={tab.value}
              onClick={() => setActiveTab(tab.value)}
              className={`flex items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                activeTab === tab.value
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* Tab Content */}
      <div>
        {/* ====== OVERVIEW TAB ====== */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Stats Cards */}
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-center gap-2 text-slate-500">
                  <Eye className="h-4 w-4" />
                  <span className="text-xs font-medium">Views</span>
                </div>
                <p className="mt-1 text-2xl font-bold text-slate-900">{story.view_count ?? 0}</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-center gap-2 text-slate-500">
                  <Heart className="h-4 w-4" />
                  <span className="text-xs font-medium">Likes</span>
                </div>
                <p className="mt-1 text-2xl font-bold text-slate-900">{story.like_count ?? 0}</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-center gap-2 text-slate-500">
                  <Layers className="h-4 w-4" />
                  <span className="text-xs font-medium">Versions</span>
                </div>
                <p className="mt-1 text-2xl font-bold text-slate-900">
                  {story.story_versions?.length ?? 0}
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-center gap-2 text-slate-500">
                  <Clock className="h-4 w-4" />
                  <span className="text-xs font-medium">Published</span>
                </div>
                <p className="mt-1 text-sm font-semibold text-slate-900">
                  {story.published_at
                    ? new Date(story.published_at).toLocaleDateString()
                    : 'Not yet'}
                </p>
              </div>
            </div>

            {/* Details Card */}
            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="mb-4 text-lg font-semibold text-slate-900">Story Details</h2>
              <dl className="space-y-4">
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wider text-slate-500">
                    Category
                  </dt>
                  <dd className="mt-1">
                    {story.categories ? (
                      <span
                        className="inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium"
                        style={{
                          backgroundColor: `${story.categories.color}20`,
                          color: story.categories.color,
                        }}
                      >
                        {story.categories.name}
                      </span>
                    ) : (
                      <span className="text-sm text-slate-400">No category</span>
                    )}
                  </dd>
                </div>

                {story.summary && (
                  <div>
                    <dt className="text-xs font-medium uppercase tracking-wider text-slate-500">
                      Summary
                    </dt>
                    <dd className="mt-1 text-sm text-slate-700">{story.summary}</dd>
                  </div>
                )}

                <div>
                  <dt className="text-xs font-medium uppercase tracking-wider text-slate-500">
                    Master Content
                  </dt>
                  <dd className="mt-1 max-h-64 overflow-y-auto whitespace-pre-wrap rounded-lg bg-slate-50 p-4 text-sm text-slate-700">
                    {story.master_content}
                  </dd>
                </div>

                {(story.source_name || story.source_url) && (
                  <div>
                    <dt className="text-xs font-medium uppercase tracking-wider text-slate-500">
                      Source
                    </dt>
                    <dd className="mt-1 text-sm text-slate-700">
                      {story.source_url ? (
                        <a
                          href={story.source_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-700"
                        >
                          {story.source_name || story.source_url}
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      ) : (
                        story.source_name
                      )}
                    </dd>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <dt className="text-xs font-medium uppercase tracking-wider text-slate-500">
                      Created
                    </dt>
                    <dd className="mt-1 text-sm text-slate-700">
                      {new Date(story.created_at).toLocaleString()}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium uppercase tracking-wider text-slate-500">
                      Updated
                    </dt>
                    <dd className="mt-1 text-sm text-slate-700">
                      {new Date(story.updated_at).toLocaleString()}
                    </dd>
                  </div>
                </div>

                {/* Pipeline status */}
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wider text-slate-500">
                    Pipeline Status
                  </dt>
                  <dd className="mt-2 flex flex-wrap gap-2">
                    <PipelineBadge label="Versions" done={story.versions_generated} />
                    <PipelineBadge label="Audio" done={story.audio_generated} />
                    <PipelineBadge label="Map" done={story.map_fetched} />
                    <PipelineBadge label="Photos" done={story.photos_fetched} />
                  </dd>
                </div>
              </dl>
            </div>
          </div>
        )}

        {/* ====== VERSIONS TAB ====== */}
        {activeTab === 'versions' && (
          <div className="space-y-4">
            {(!story.story_versions || story.story_versions.length === 0) ? (
              <div className="flex flex-col items-center justify-center rounded-xl border border-slate-200 bg-white py-16 shadow-sm">
                <Layers className="mb-3 h-10 w-10 text-slate-300" />
                <p className="text-sm font-medium text-slate-500">No versions generated yet</p>
                <p className="mt-1 text-xs text-slate-400">
                  Versions will appear once the content pipeline completes.
                </p>
              </div>
            ) : (
              story.story_versions.map((version) => (
                <div
                  key={version.id}
                  className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
                >
                  {/* Version Header */}
                  <div className="mb-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <h3 className="text-lg font-semibold text-slate-900">
                        Ages {version.age_range}
                      </h3>
                      <span
                        className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${
                          STATUS_COLORS[version.status] ?? 'bg-gray-100 text-gray-700'
                        }`}
                      >
                        {version.status}
                      </span>
                      {version.word_count > 0 && (
                        <span className="text-xs text-slate-400">
                          {version.word_count} words
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {version.status === 'review' && (
                        <button
                          onClick={() => handleApprove(version.age_range)}
                          disabled={approvingVersion === version.age_range}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-green-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-green-700 disabled:opacity-60"
                        >
                          {approvingVersion === version.age_range ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <CheckCircle className="h-3 w-3" />
                          )}
                          Approve
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Content */}
                  {editMode ? (
                    <textarea
                      rows={8}
                      value={editingVersions[version.age_range] ?? ''}
                      onChange={(e) =>
                        setEditingVersions((prev) => ({
                          ...prev,
                          [version.age_range]: e.target.value,
                        }))
                      }
                      className="block w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm placeholder-slate-400 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                  ) : (
                    <div className="max-h-48 overflow-y-auto whitespace-pre-wrap rounded-lg bg-slate-50 p-4 text-sm text-slate-700">
                      {version.rewritten_content || 'No content yet.'}
                    </div>
                  )}

                  {/* Audio Player */}
                  {version.audio_url && (
                    <div className="mt-4">
                      <p className="mb-1 text-xs font-medium text-slate-500">Audio Narration</p>
                      <audio
                        controls
                        src={version.audio_url}
                        className="w-full"
                        preload="metadata"
                      >
                        Your browser does not support the audio element.
                      </audio>
                      {version.audio_duration_s && (
                        <p className="mt-1 text-xs text-slate-400">
                          Duration: {Math.floor(version.audio_duration_s / 60)}:
                          {String(Math.round(version.audio_duration_s % 60)).padStart(2, '0')}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Save Button (edit mode) */}
                  {editMode && (
                    <div className="mt-4 flex justify-end">
                      <button
                        onClick={() => handleSaveVersion(version.age_range)}
                        disabled={savingVersion === version.age_range}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 disabled:opacity-60"
                      >
                        {savingVersion === version.age_range ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : null}
                        Save Changes
                      </button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {/* ====== PHOTOS TAB ====== */}
        {activeTab === 'photos' && (
          <div>
            {(!story.story_photos || story.story_photos.length === 0) ? (
              <div className="flex flex-col items-center justify-center rounded-xl border border-slate-200 bg-white py-16 shadow-sm">
                <ImageIcon className="mb-3 h-10 w-10 text-slate-300" />
                <p className="text-sm font-medium text-slate-500">No photos yet</p>
                <p className="mt-1 text-xs text-slate-400">
                  Photos will appear once the photo pipeline completes.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {story.story_photos.map((photo) => (
                  <div
                    key={photo.id}
                    className="group overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
                  >
                    <div className="relative aspect-video bg-slate-100">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={photo.url}
                        alt={photo.alt_text ?? 'Story photo'}
                        className="h-full w-full object-cover"
                      />
                    </div>
                    <div className="p-3">
                      {photo.alt_text && (
                        <p className="text-sm text-slate-700">{photo.alt_text}</p>
                      )}
                      {photo.photographer && (
                        <p className="mt-1 text-xs text-slate-400">
                          Photo by{' '}
                          {photo.photographer_url ? (
                            <a
                              href={photo.photographer_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-500 hover:text-blue-600"
                            >
                              {photo.photographer}
                            </a>
                          ) : (
                            photo.photographer
                          )}
                          {photo.unsplash_id && ' on Unsplash'}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ====== MAP TAB ====== */}
        {activeTab === 'map' && (
          <div>
            {(!story.story_maps || story.story_maps.length === 0) ? (
              <div className="flex flex-col items-center justify-center rounded-xl border border-slate-200 bg-white py-16 shadow-sm">
                <Map className="mb-3 h-10 w-10 text-slate-300" />
                <p className="text-sm font-medium text-slate-500">No map data yet</p>
                <p className="mt-1 text-xs text-slate-400">
                  Map data will appear once location queries are processed.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {story.story_maps.map((mapData) => (
                  <div
                    key={mapData.id}
                    className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
                  >
                    <h3 className="mb-4 text-lg font-semibold text-slate-900">Map Data</h3>
                    <dl className="space-y-3">
                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <dt className="text-xs font-medium uppercase tracking-wider text-slate-500">
                            Center Latitude
                          </dt>
                          <dd className="mt-1 text-sm font-mono text-slate-700">
                            {mapData.center_lat}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-xs font-medium uppercase tracking-wider text-slate-500">
                            Center Longitude
                          </dt>
                          <dd className="mt-1 text-sm font-mono text-slate-700">
                            {mapData.center_lng}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-xs font-medium uppercase tracking-wider text-slate-500">
                            Zoom Level
                          </dt>
                          <dd className="mt-1 text-sm font-mono text-slate-700">
                            {mapData.zoom}
                          </dd>
                        </div>
                      </div>
                      {mapData.geojson != null && (
                        <div>
                          <dt className="text-xs font-medium uppercase tracking-wider text-slate-500">
                            GeoJSON Preview
                          </dt>
                          <dd className="mt-2 max-h-64 overflow-auto rounded-lg bg-slate-50 p-4">
                            <pre className="text-xs text-slate-600">
                              {JSON.stringify(mapData.geojson, null, 2)}
                            </pre>
                          </dd>
                        </div>
                      )}
                    </dl>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ====== COMMENTS TAB ====== */}
        {activeTab === 'comments' && (
          <div>
            {notes.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-xl border border-slate-200 bg-white py-16 shadow-sm">
                <MessageSquare className="mb-3 h-10 w-10 text-slate-300" />
                <p className="text-sm font-medium text-slate-500">No comments yet</p>
                <p className="mt-1 text-xs text-slate-400">
                  Editor notes and moderation comments will appear here.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {notes.map((note) => (
                  <div
                    key={note.id}
                    className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-slate-900">
                        {note.users?.display_name ?? 'Unknown'}
                      </p>
                      <span className="text-xs text-slate-400">
                        {new Date(note.created_at).toLocaleString()}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-slate-700">{note.note}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function PipelineBadge({ label, done }: { label: string; done: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${
        done ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'
      }`}
    >
      {done ? <CheckCircle className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
      {label}
    </span>
  )
}
