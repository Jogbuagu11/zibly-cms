'use client'

import { useState, useEffect, useCallback } from 'react'
import { apiFetch } from '@/lib/api'
import {
  CreditCard,
  DollarSign,
  Users,
  UserPlus,
  ChevronLeft,
  ChevronRight,
  Inbox,
  AlertCircle,
} from 'lucide-react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SubscriptionStats {
  totalActive: number
  mrr: number
  freeUsers: number
  familyPlans: number
}

interface Subscription {
  id: string
  user_name: string
  user_email: string
  plan: 'free' | 'premium' | 'family'
  status: 'active' | 'cancelled' | 'expired' | 'trialing'
  amount: number
  interval: string
  current_period_end: string
  stripe_subscription_id: string
}

type TabKey = 'active' | 'cancelled' | 'expired' | 'trialing'

const TABS: { key: TabKey; label: string }[] = [
  { key: 'active', label: 'Active' },
  { key: 'cancelled', label: 'Cancelled' },
  { key: 'expired', label: 'Expired' },
  { key: 'trialing', label: 'Trialing' },
]

const PLAN_COLORS: Record<string, string> = {
  free: 'bg-slate-100 text-slate-700',
  premium: 'bg-blue-100 text-blue-700',
  family: 'bg-purple-100 text-purple-700',
}

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
  expired: 'bg-slate-100 text-slate-700',
  trialing: 'bg-amber-100 text-amber-700',
}

const PAGE_SIZE = 20

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function formatCurrency(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`
}

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

function TableRowSkeleton() {
  return (
    <tr className="animate-pulse">
      <td className="px-6 py-4"><div className="space-y-1"><div className="h-4 w-28 rounded bg-slate-200" /><div className="h-3 w-36 rounded bg-slate-200" /></div></td>
      <td className="px-6 py-4"><div className="h-5 w-16 rounded-full bg-slate-200" /></td>
      <td className="px-6 py-4"><div className="h-5 w-16 rounded-full bg-slate-200" /></td>
      <td className="px-6 py-4"><div className="h-4 w-14 rounded bg-slate-200" /></td>
      <td className="px-6 py-4"><div className="h-4 w-16 rounded bg-slate-200" /></td>
      <td className="px-6 py-4"><div className="h-4 w-20 rounded bg-slate-200" /></td>
      <td className="px-6 py-4"><div className="h-4 w-24 rounded bg-slate-200" /></td>
    </tr>
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

export default function SubscriptionsPage() {
  const [tab, setTab] = useState<TabKey>('active')
  const [stats, setStats] = useState<SubscriptionStats | null>(null)
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([])
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(true)
  const [statsLoading, setStatsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Fetch stats once
  useEffect(() => {
    async function loadStats() {
      try {
        setStatsLoading(true)
        const data = await apiFetch('/api/subscriptions?stats=true')
        setStats(data)
      } catch (err) {
        console.error('Failed to load subscription stats:', err)
      } finally {
        setStatsLoading(false)
      }
    }
    loadStats()
  }, [])

  // Fetch subscriptions
  const fetchSubscriptions = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const params = new URLSearchParams()
      params.set('status', tab)
      params.set('page', String(page))
      params.set('limit', String(PAGE_SIZE))

      const data = await apiFetch(`/api/subscriptions?${params.toString()}`)
      setSubscriptions(data.subscriptions ?? data ?? [])
      setTotalPages(Math.max(1, Math.ceil((data.total ?? data.length ?? 0) / PAGE_SIZE)))
    } catch (err) {
      console.error('Failed to load subscriptions:', err)
      setError('Unable to load subscriptions. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [tab, page])

  useEffect(() => {
    fetchSubscriptions()
  }, [fetchSubscriptions])

  useEffect(() => {
    setPage(1)
  }, [tab])

  // ---- Error state ----------------------------------------------------------
  if (error && !loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-center">
          <AlertCircle className="h-10 w-10 text-red-400" />
          <p className="text-slate-600">{error}</p>
          <button
            onClick={() => fetchSubscriptions()}
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
        <h1 className="text-2xl font-bold text-slate-900">Subscriptions</h1>
        <p className="mt-1 text-sm text-slate-500">
          Monitor subscription plans, revenue, and user billing.
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statsLoading ? (
          <>
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
          </>
        ) : (
          <>
            <StatCard
              label="Total Active"
              value={stats?.totalActive ?? 0}
              icon={<CreditCard className="h-5 w-5 text-green-500" />}
              borderColor="border-l-green-500"
            />
            <StatCard
              label="MRR"
              value={`$${((stats?.mrr ?? 0) / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
              icon={<DollarSign className="h-5 w-5 text-blue-500" />}
              borderColor="border-l-blue-500"
            />
            <StatCard
              label="Free Users"
              value={stats?.freeUsers ?? 0}
              icon={<Users className="h-5 w-5 text-slate-500" />}
              borderColor="border-l-slate-400"
            />
            <StatCard
              label="Family Plans"
              value={stats?.familyPlans ?? 0}
              icon={<UserPlus className="h-5 w-5 text-purple-500" />}
              borderColor="border-l-purple-500"
            />
          </>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              tab === t.key
                ? 'bg-blue-600 text-white'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="px-6 py-3 text-left font-semibold text-slate-600">User</th>
                <th className="px-6 py-3 text-left font-semibold text-slate-600">Plan</th>
                <th className="px-6 py-3 text-left font-semibold text-slate-600">Status</th>
                <th className="px-6 py-3 text-left font-semibold text-slate-600">Amount</th>
                <th className="px-6 py-3 text-left font-semibold text-slate-600">Interval</th>
                <th className="px-6 py-3 text-left font-semibold text-slate-600">Period End</th>
                <th className="px-6 py-3 text-left font-semibold text-slate-600">Stripe ID</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                Array.from({ length: 8 }).map((_, i) => <TableRowSkeleton key={i} />)
              ) : subscriptions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <Inbox className="h-10 w-10 text-slate-300" />
                      <p className="text-sm text-slate-400">No {tab} subscriptions found.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                subscriptions.map((sub) => (
                  <tr key={sub.id} className="transition-colors hover:bg-slate-50">
                    <td className="px-6 py-4">
                      <div>
                        <p className="font-medium text-slate-900">{sub.user_name || 'Unnamed'}</p>
                        <p className="text-xs text-slate-500">{sub.user_email}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${PLAN_COLORS[sub.plan] ?? 'bg-slate-100 text-slate-700'}`}>
                        {sub.plan}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${STATUS_COLORS[sub.status] ?? 'bg-slate-100 text-slate-700'}`}>
                        {sub.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-700">{formatCurrency(sub.amount)}</td>
                    <td className="px-6 py-4 capitalize text-slate-600">{sub.interval}</td>
                    <td className="px-6 py-4 text-slate-600">{formatDate(sub.current_period_end)}</td>
                    <td className="px-6 py-4">
                      <span className="font-mono text-xs text-slate-500">{sub.stripe_subscription_id}</span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

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
    </div>
  )
}
