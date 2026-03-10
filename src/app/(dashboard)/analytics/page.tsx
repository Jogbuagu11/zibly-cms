'use client'

import { useState, useEffect, useCallback } from 'react'
import { apiFetch } from '@/lib/api'
import {
  BookOpen,
  Users,
  Headphones,
  TrendingUp,
  AlertCircle,
} from 'lucide-react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AnalyticsStats {
  totalReads: number
  uniqueReaders: number
  audioListens: number
  avgCompletionPercent: number
}

interface TopStory {
  id: string
  title: string
  view_count: number
  category: string
}

interface AgeRangeStats {
  age_range: string
  total_reads: number
  unique_readers: number
  avg_completion: number
}

interface SubscriptionDistribution {
  free: number
  premium: number
  family: number
}

interface AnalyticsData {
  stats: AnalyticsStats
  topStories: TopStory[]
  readsByAgeRange: AgeRangeStats[]
  subscriptionDistribution: SubscriptionDistribution
}

type Period = '7d' | '30d' | '90d'

const PERIODS: { key: Period; label: string }[] = [
  { key: '7d', label: '7 days' },
  { key: '30d', label: '30 days' },
  { key: '90d', label: '90 days' },
]

// ---------------------------------------------------------------------------
// Skeletons
// ---------------------------------------------------------------------------

function StatCardSkeleton() {
  return (
    <div className="animate-pulse rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-center gap-4">
        <div className="h-10 w-10 rounded-lg bg-slate-200" />
        <div className="space-y-2">
          <div className="h-3 w-20 rounded bg-slate-200" />
          <div className="h-6 w-16 rounded bg-slate-200" />
        </div>
      </div>
    </div>
  )
}

function BarSkeleton() {
  return (
    <div className="animate-pulse space-y-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="space-y-1">
          <div className="h-3 w-32 rounded bg-slate-200" />
          <div className="h-6 rounded bg-slate-200" style={{ width: `${80 - i * 12}%` }} />
        </div>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Stat Card
// ---------------------------------------------------------------------------

function StatCard({
  label,
  value,
  icon,
  borderColor,
}: {
  label: string
  value: string | number
  icon: React.ReactNode
  borderColor: string
}) {
  return (
    <div className={`rounded-xl border border-slate-200 bg-white p-6 shadow-sm border-l-4 ${borderColor} transition-shadow hover:shadow-md`}>
      <div className="flex items-center gap-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-50">
          {icon}
        </div>
        <div>
          <p className="text-sm text-slate-500">{label}</p>
          <p className="text-2xl font-semibold text-slate-900">{value}</p>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function AnalyticsPage() {
  const [period, setPeriod] = useState<Period>('30d')
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchAnalytics = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const result = await apiFetch(`/api/analytics?period=${period}`)
      setData(result)
    } catch (err) {
      console.error('Failed to load analytics:', err)
      setError('Unable to load analytics. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [period])

  useEffect(() => {
    fetchAnalytics()
  }, [fetchAnalytics])

  // Compute max view count for bar chart scaling
  const maxViews = data?.topStories?.reduce((max, s) => Math.max(max, s.view_count), 0) ?? 1

  // Subscription distribution totals
  const subTotal = data ? (data.subscriptionDistribution.free + data.subscriptionDistribution.premium + data.subscriptionDistribution.family) : 1

  // ---- Error state ----------------------------------------------------------
  if (error && !loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-center">
          <AlertCircle className="h-10 w-10 text-red-400" />
          <p className="text-slate-600">{error}</p>
          <button
            onClick={() => fetchAnalytics()}
            className="mt-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Header + Period selector */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Analytics</h1>
          <p className="mt-1 text-sm text-slate-500">
            Content performance and reader engagement metrics.
          </p>
        </div>

        <div className="flex gap-2">
          {PERIODS.map((p) => (
            <button
              key={p.key}
              onClick={() => setPeriod(p.key)}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                period === p.key
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
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
              label="Total Reads"
              value={(data?.stats.totalReads ?? 0).toLocaleString()}
              icon={<BookOpen className="h-5 w-5 text-blue-500" />}
              borderColor="border-l-blue-500"
            />
            <StatCard
              label="Unique Readers"
              value={(data?.stats.uniqueReaders ?? 0).toLocaleString()}
              icon={<Users className="h-5 w-5 text-green-500" />}
              borderColor="border-l-green-500"
            />
            <StatCard
              label="Audio Listens"
              value={(data?.stats.audioListens ?? 0).toLocaleString()}
              icon={<Headphones className="h-5 w-5 text-purple-500" />}
              borderColor="border-l-purple-500"
            />
            <StatCard
              label="Avg Completion %"
              value={`${data?.stats.avgCompletionPercent ?? 0}%`}
              icon={<TrendingUp className="h-5 w-5 text-amber-500" />}
              borderColor="border-l-amber-500"
            />
          </>
        )}
      </div>

      {/* Two-column: Top Stories + Reads by Age Range */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Top Stories */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Top Stories</h2>
          <p className="mt-0.5 text-xs text-slate-500">By view count</p>

          {loading ? (
            <div className="mt-5">
              <BarSkeleton />
            </div>
          ) : !data?.topStories?.length ? (
            <p className="mt-8 text-center text-sm text-slate-400">No story data available.</p>
          ) : (
            <div className="mt-5 space-y-4">
              {data.topStories.map((story, index) => {
                const pct = maxViews > 0 ? (story.view_count / maxViews) * 100 : 0
                const barColors = [
                  'bg-blue-500',
                  'bg-green-500',
                  'bg-purple-500',
                  'bg-amber-500',
                  'bg-rose-500',
                  'bg-cyan-500',
                  'bg-indigo-500',
                  'bg-teal-500',
                ]
                const barColor = barColors[index % barColors.length]

                return (
                  <div key={story.id}>
                    <div className="flex items-center justify-between text-sm">
                      <span className="truncate font-medium text-slate-900 pr-4">{story.title}</span>
                      <span className="shrink-0 text-slate-500">{story.view_count.toLocaleString()}</span>
                    </div>
                    <div className="mt-1 h-2 w-full rounded-full bg-slate-100">
                      <div
                        className={`h-2 rounded-full ${barColor} transition-all duration-500`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <p className="mt-0.5 text-xs text-slate-400">{story.category}</p>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Reads by Age Range */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Reads by Age Range</h2>
          <p className="mt-0.5 text-xs text-slate-500">Engagement per age group</p>

          {loading ? (
            <div className="mt-5 grid grid-cols-1 gap-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="animate-pulse rounded-lg border border-slate-200 p-4">
                  <div className="h-4 w-12 rounded bg-slate-200" />
                  <div className="mt-2 h-5 w-16 rounded bg-slate-200" />
                </div>
              ))}
            </div>
          ) : !data?.readsByAgeRange?.length ? (
            <p className="mt-8 text-center text-sm text-slate-400">No age range data available.</p>
          ) : (
            <div className="mt-5 grid grid-cols-1 gap-4">
              {data.readsByAgeRange.map((ageGroup) => {
                const colors: Record<string, { border: string; bg: string; text: string }> = {
                  '7-10': { border: 'border-sky-200', bg: 'bg-sky-50', text: 'text-sky-700' },
                  '11-14': { border: 'border-amber-200', bg: 'bg-amber-50', text: 'text-amber-700' },
                  '15-17': { border: 'border-purple-200', bg: 'bg-purple-50', text: 'text-purple-700' },
                }
                const style = colors[ageGroup.age_range] ?? { border: 'border-slate-200', bg: 'bg-slate-50', text: 'text-slate-700' }

                return (
                  <div key={ageGroup.age_range} className={`rounded-lg border ${style.border} ${style.bg} p-4`}>
                    <p className={`text-sm font-semibold ${style.text}`}>Ages {ageGroup.age_range}</p>
                    <div className="mt-3 grid grid-cols-3 gap-4 text-center">
                      <div>
                        <p className="text-lg font-bold text-slate-900">{ageGroup.total_reads.toLocaleString()}</p>
                        <p className="text-xs text-slate-500">Reads</p>
                      </div>
                      <div>
                        <p className="text-lg font-bold text-slate-900">{ageGroup.unique_readers.toLocaleString()}</p>
                        <p className="text-xs text-slate-500">Readers</p>
                      </div>
                      <div>
                        <p className="text-lg font-bold text-slate-900">{ageGroup.avg_completion}%</p>
                        <p className="text-xs text-slate-500">Completion</p>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Subscription Stats */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Subscription Distribution</h2>
        <p className="mt-0.5 text-xs text-slate-500">Breakdown of user subscription tiers</p>

        {loading ? (
          <div className="mt-5 animate-pulse space-y-3">
            <div className="h-8 w-full rounded-full bg-slate-200" />
            <div className="flex justify-center gap-6">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-4 w-20 rounded bg-slate-200" />
              ))}
            </div>
          </div>
        ) : data ? (
          <div className="mt-5">
            {/* Segmented bar */}
            <div className="flex h-8 w-full overflow-hidden rounded-full bg-slate-100">
              {data.subscriptionDistribution.free > 0 && (
                <div
                  className="flex items-center justify-center bg-slate-400 text-xs font-semibold text-white transition-all duration-500"
                  style={{ width: `${(data.subscriptionDistribution.free / subTotal) * 100}%` }}
                >
                  {Math.round((data.subscriptionDistribution.free / subTotal) * 100)}%
                </div>
              )}
              {data.subscriptionDistribution.premium > 0 && (
                <div
                  className="flex items-center justify-center bg-blue-500 text-xs font-semibold text-white transition-all duration-500"
                  style={{ width: `${(data.subscriptionDistribution.premium / subTotal) * 100}%` }}
                >
                  {Math.round((data.subscriptionDistribution.premium / subTotal) * 100)}%
                </div>
              )}
              {data.subscriptionDistribution.family > 0 && (
                <div
                  className="flex items-center justify-center bg-purple-500 text-xs font-semibold text-white transition-all duration-500"
                  style={{ width: `${(data.subscriptionDistribution.family / subTotal) * 100}%` }}
                >
                  {Math.round((data.subscriptionDistribution.family / subTotal) * 100)}%
                </div>
              )}
            </div>

            {/* Legend */}
            <div className="mt-4 flex flex-wrap justify-center gap-6">
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-slate-400" />
                <span className="text-sm text-slate-600">Free ({data.subscriptionDistribution.free.toLocaleString()})</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-blue-500" />
                <span className="text-sm text-slate-600">Premium ({data.subscriptionDistribution.premium.toLocaleString()})</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-purple-500" />
                <span className="text-sm text-slate-600">Family ({data.subscriptionDistribution.family.toLocaleString()})</span>
              </div>
            </div>

            {/* Numeric breakdown */}
            <div className="mt-6 grid grid-cols-3 gap-4 text-center">
              <div className="rounded-lg border border-slate-200 p-4">
                <p className="text-2xl font-bold text-slate-900">{data.subscriptionDistribution.free.toLocaleString()}</p>
                <p className="text-sm text-slate-500">Free</p>
              </div>
              <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
                <p className="text-2xl font-bold text-slate-900">{data.subscriptionDistribution.premium.toLocaleString()}</p>
                <p className="text-sm text-blue-600">Premium</p>
              </div>
              <div className="rounded-lg border border-purple-200 bg-purple-50 p-4">
                <p className="text-2xl font-bold text-slate-900">{data.subscriptionDistribution.family.toLocaleString()}</p>
                <p className="text-sm text-purple-600">Family</p>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}
