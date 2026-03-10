'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import {
  FileText,
  Clock,
  CreditCard,
  DollarSign,
  ArrowRight,
  AlertCircle,
  Inbox,
} from 'lucide-react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Analytics {
  totalStories: number
  pendingReview: number
  activeSubscribers: number
  monthlyRevenue: number
}

interface PendingStory {
  id: string
  title: string
  category: string
  created_at: string
}

interface PendingComment {
  id: string
  author: string
  body: string
  story_title: string
  created_at: string
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function fetchWithAuth(endpoint: string) {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  const res = await fetch(endpoint, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error(`Failed to fetch ${endpoint}`)
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
// Skeleton loaders
// ---------------------------------------------------------------------------

function StatCardSkeleton() {
  return (
    <div className="animate-pulse rounded-xl border border-gray-200 bg-white p-5">
      <div className="flex items-center gap-4">
        <div className="h-10 w-10 rounded-lg bg-gray-200" />
        <div className="flex-1 space-y-2">
          <div className="h-3 w-20 rounded bg-gray-200" />
          <div className="h-6 w-16 rounded bg-gray-200" />
        </div>
      </div>
    </div>
  )
}

function ListSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-4">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="animate-pulse space-y-2">
          <div className="h-4 w-3/4 rounded bg-gray-200" />
          <div className="h-3 w-1/2 rounded bg-gray-200" />
        </div>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Stat card
// ---------------------------------------------------------------------------

interface StatCardProps {
  label: string
  value: string | number
  icon: React.ReactNode
  borderColor: string
}

function StatCard({ label, value, icon, borderColor }: StatCardProps) {
  return (
    <div
      className={`rounded-xl border border-gray-200 bg-white p-5 border-l-4 ${borderColor} transition-shadow hover:shadow-md`}
    >
      <div className="flex items-center gap-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-50">
          {icon}
        </div>
        <div>
          <p className="text-sm text-gray-500">{label}</p>
          <p className="text-2xl font-semibold text-gray-900">{value}</p>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Dashboard page
// ---------------------------------------------------------------------------

export default function DashboardPage() {
  const [analytics, setAnalytics] = useState<Analytics | null>(null)
  const [stories, setStories] = useState<PendingStory[]>([])
  const [comments, setComments] = useState<PendingComment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadDashboard() {
      try {
        setLoading(true)
        setError(null)

        const [analyticsData, storiesData, commentsData] = await Promise.all([
          fetchWithAuth('/api/analytics'),
          fetchWithAuth('/api/stories?status=review&limit=5'),
          fetchWithAuth('/api/comments?status=pending&limit=5'),
        ])

        setAnalytics(analyticsData)
        setStories(storiesData?.stories ?? storiesData ?? [])
        setComments(commentsData?.comments ?? commentsData ?? [])
      } catch (err) {
        console.error('Dashboard load error:', err)
        setError('Unable to load dashboard data. Please try again.')
      } finally {
        setLoading(false)
      }
    }

    loadDashboard()
  }, [])

  // ---- Error state --------------------------------------------------------

  if (error) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-center">
          <AlertCircle className="h-10 w-10 text-red-400" />
          <p className="text-gray-600">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-2 rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-800"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  // ---- Main render --------------------------------------------------------

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="mt-1 text-sm text-gray-500">
          Overview of your content management system.
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {loading ? (
          <>
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
          </>
        ) : (
          <>
            <StatCard
              label="Total Stories"
              value={analytics?.totalStories ?? 0}
              icon={<FileText className="h-5 w-5 text-blue-500" />}
              borderColor="border-l-blue-500"
            />
            <StatCard
              label="Pending Review"
              value={analytics?.pendingReview ?? 0}
              icon={<Clock className="h-5 w-5 text-amber-500" />}
              borderColor="border-l-amber-500"
            />
            <StatCard
              label="Active Subscribers"
              value={analytics?.activeSubscribers ?? 0}
              icon={<CreditCard className="h-5 w-5 text-green-500" />}
              borderColor="border-l-green-500"
            />
            <StatCard
              label="Monthly Revenue"
              value={`$${(analytics?.monthlyRevenue ?? 0).toLocaleString()}`}
              icon={<DollarSign className="h-5 w-5 text-purple-500" />}
              borderColor="border-l-purple-500"
            />
          </>
        )}
      </div>

      {/* Two-column lists */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Pending Review */}
        <div className="rounded-xl border border-gray-200 bg-white">
          <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
            <h2 className="font-semibold text-gray-900">Pending Review</h2>
            <Link
              href="/stories?status=review"
              className="flex items-center gap-1 text-sm font-medium text-blue-600 transition-colors hover:text-blue-700"
            >
              View all <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          <div className="divide-y divide-gray-100 px-5">
            {loading ? (
              <div className="py-4">
                <ListSkeleton rows={4} />
              </div>
            ) : stories.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-10 text-center">
                <Inbox className="h-8 w-8 text-gray-300" />
                <p className="text-sm text-gray-400">
                  No stories pending review.
                </p>
              </div>
            ) : (
              stories.map((story) => (
                <div
                  key={story.id}
                  className="flex items-center justify-between py-3.5 transition-colors hover:bg-gray-50 -mx-5 px-5"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-gray-900">
                      {story.title}
                    </p>
                    <p className="mt-0.5 text-xs text-gray-500">
                      {story.category}
                      <span className="mx-1.5 text-gray-300">&middot;</span>
                      {timeAgo(story.created_at)}
                    </p>
                  </div>
                  <Link
                    href={`/stories/${story.id}/review`}
                    className="ml-4 shrink-0 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:border-gray-300 hover:bg-gray-50"
                  >
                    Review
                  </Link>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Comments Queue */}
        <div className="rounded-xl border border-gray-200 bg-white">
          <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
            <h2 className="font-semibold text-gray-900">Comments Queue</h2>
            <Link
              href="/comments?status=pending"
              className="flex items-center gap-1 text-sm font-medium text-blue-600 transition-colors hover:text-blue-700"
            >
              View all <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          <div className="divide-y divide-gray-100 px-5">
            {loading ? (
              <div className="py-4">
                <ListSkeleton rows={4} />
              </div>
            ) : comments.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-10 text-center">
                <Inbox className="h-8 w-8 text-gray-300" />
                <p className="text-sm text-gray-400">
                  No comments awaiting moderation.
                </p>
              </div>
            ) : (
              comments.map((comment) => (
                <div
                  key={comment.id}
                  className="flex items-center justify-between py-3.5 transition-colors hover:bg-gray-50 -mx-5 px-5"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-900">
                      {comment.author}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-gray-500">
                      {comment.body.length > 80
                        ? `${comment.body.slice(0, 80)}...`
                        : comment.body}
                    </p>
                    <p className="mt-0.5 text-xs text-gray-400">
                      on{' '}
                      <span className="font-medium text-gray-500">
                        {comment.story_title}
                      </span>
                      <span className="mx-1.5 text-gray-300">&middot;</span>
                      {timeAgo(comment.created_at)}
                    </p>
                  </div>
                  <Link
                    href={`/comments/${comment.id}`}
                    className="ml-4 shrink-0 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:border-gray-300 hover:bg-gray-50"
                  >
                    Moderate
                  </Link>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
