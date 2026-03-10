'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import {
  Plus,
  Search,
  Loader2,
  Eye,
  Pencil,
  ChevronLeft,
  ChevronRight,
  FileText,
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

type Status = 'all' | 'draft' | 'review' | 'approved' | 'published' | 'archived'

interface Story {
  id: string
  title: string
  status: string
  is_breaking: boolean
  created_at: string
  categories: { id: string; name: string; slug: string; color: string } | null
  users: { id: string; display_name: string; avatar_url: string | null } | null
}

interface Pagination {
  page: number
  limit: number
  total: number
  pages: number
}

const STATUS_TABS: { label: string; value: Status }[] = [
  { label: 'All', value: 'all' },
  { label: 'Draft', value: 'draft' },
  { label: 'Review', value: 'review' },
  { label: 'Approved', value: 'approved' },
  { label: 'Published', value: 'published' },
  { label: 'Archived', value: 'archived' },
]

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700',
  review: 'bg-amber-100 text-amber-700',
  approved: 'bg-blue-100 text-blue-700',
  published: 'bg-green-100 text-green-700',
  archived: 'bg-red-100 text-red-700',
}

export default function StoriesPage() {
  const [stories, setStories] = useState<Story[]>([])
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 20, total: 0, pages: 0 })
  const [activeTab, setActiveTab] = useState<Status>('all')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const fetchStories = useCallback(async (status: Status, page: number) => {
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20' })
      if (status !== 'all') params.set('status', status)
      const data = await apiFetch(`/api/stories?${params.toString()}`)
      setStories(data.stories ?? [])
      setPagination(data.pagination ?? { page: 1, limit: 20, total: 0, pages: 0 })
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load stories')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchStories(activeTab, 1)
  }, [activeTab, fetchStories])

  function handleTabChange(tab: Status) {
    setActiveTab(tab)
  }

  function handlePageChange(newPage: number) {
    fetchStories(activeTab, newPage)
  }

  const filteredStories = search
    ? stories.filter((s) => s.title.toLowerCase().includes(search.toLowerCase()))
    : stories

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Stories</h1>
        <Link
          href="/stories/new"
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" />
          New Story
        </Link>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => handleTabChange(tab.value)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              activeTab === tab.value
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          placeholder="Search stories..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-lg border border-slate-300 py-2.5 pl-10 pr-4 text-sm placeholder-slate-400 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
        />
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        {loading ? (
          <div className="space-y-0 divide-y divide-slate-100">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-6 py-4">
                <div className="h-4 w-48 animate-pulse rounded bg-slate-200" />
                <div className="h-5 w-20 animate-pulse rounded-full bg-slate-200" />
                <div className="h-5 w-16 animate-pulse rounded-full bg-slate-200" />
                <div className="ml-auto h-4 w-24 animate-pulse rounded bg-slate-200" />
                <div className="h-4 w-20 animate-pulse rounded bg-slate-200" />
              </div>
            ))}
          </div>
        ) : filteredStories.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-500">
            <FileText className="mb-3 h-10 w-10 text-slate-300" />
            <p className="text-sm font-medium">No stories found</p>
            <p className="mt-1 text-xs text-slate-400">
              {search ? 'Try a different search term' : 'Create your first story to get started'}
            </p>
          </div>
        ) : (
          <>
            {/* Table Header */}
            <div className="hidden border-b border-slate-200 bg-slate-50 px-6 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500 md:grid md:grid-cols-12 md:gap-4">
              <div className="col-span-4">Title</div>
              <div className="col-span-2">Category</div>
              <div className="col-span-2">Status</div>
              <div className="col-span-2">Author</div>
              <div className="col-span-1">Created</div>
              <div className="col-span-1 text-right">Actions</div>
            </div>

            {/* Rows */}
            <div className="divide-y divide-slate-100">
              {filteredStories.map((story) => (
                <div
                  key={story.id}
                  className="grid grid-cols-1 gap-2 px-6 py-4 transition-colors hover:bg-slate-50 md:grid-cols-12 md:items-center md:gap-4"
                >
                  {/* Title */}
                  <div className="col-span-4">
                    <Link
                      href={`/stories/${story.id}`}
                      className="text-sm font-medium text-slate-900 hover:text-blue-600"
                    >
                      {story.title}
                    </Link>
                    {story.is_breaking && (
                      <span className="ml-2 inline-flex rounded bg-red-500 px-1.5 py-0.5 text-[10px] font-bold uppercase text-white">
                        Breaking
                      </span>
                    )}
                  </div>

                  {/* Category */}
                  <div className="col-span-2">
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
                      <span className="text-xs text-slate-400">--</span>
                    )}
                  </div>

                  {/* Status */}
                  <div className="col-span-2">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${
                        STATUS_COLORS[story.status] ?? 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {story.status}
                    </span>
                  </div>

                  {/* Author */}
                  <div className="col-span-2 text-sm text-slate-600">
                    {story.users?.display_name ?? '--'}
                  </div>

                  {/* Created */}
                  <div className="col-span-1 text-xs text-slate-500">
                    {new Date(story.created_at).toLocaleDateString()}
                  </div>

                  {/* Actions */}
                  <div className="col-span-1 flex items-center justify-end gap-2">
                    <Link
                      href={`/stories/${story.id}`}
                      className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                      title="View"
                    >
                      <Eye className="h-4 w-4" />
                    </Link>
                    <Link
                      href={`/stories/${story.id}`}
                      className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                      title="Edit"
                    >
                      <Pencil className="h-4 w-4" />
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Pagination */}
      {!loading && pagination.pages > 1 && (
        <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-6 py-3 shadow-sm">
          <p className="text-sm text-slate-600">
            Showing{' '}
            <span className="font-medium">{(pagination.page - 1) * pagination.limit + 1}</span>
            {' - '}
            <span className="font-medium">
              {Math.min(pagination.page * pagination.limit, pagination.total)}
            </span>{' '}
            of <span className="font-medium">{pagination.total}</span> stories
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => handlePageChange(pagination.page - 1)}
              disabled={pagination.page <= 1}
              className="inline-flex items-center gap-1 rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </button>
            <span className="text-sm text-slate-600">
              Page {pagination.page} of {pagination.pages}
            </span>
            <button
              onClick={() => handlePageChange(pagination.page + 1)}
              disabled={pagination.page >= pagination.pages}
              className="inline-flex items-center gap-1 rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
