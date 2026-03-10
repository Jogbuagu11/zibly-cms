'use client'

import { useState, useEffect, useCallback } from 'react'
import { apiFetch } from '@/lib/api'
import {
  Search,
  Shield,
  ChevronLeft,
  ChevronRight,
  Inbox,
  Loader2,
  AlertCircle,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface UserRecord {
  id: string
  full_name: string
  email: string
  role: 'child' | 'parent' | 'editor' | 'admin'
  age_range?: string
  coppa_verified: boolean
  subscription_tier?: string
  created_at: string
}

type TabKey = 'all' | 'child' | 'parent' | 'editor' | 'admin'

const TABS: { key: TabKey; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'child', label: 'Children' },
  { key: 'parent', label: 'Parents' },
  { key: 'editor', label: 'Editors' },
  { key: 'admin', label: 'Admins' },
]

const ROLE_COLORS: Record<string, string> = {
  child: 'bg-sky-100 text-sky-700',
  parent: 'bg-green-100 text-green-700',
  editor: 'bg-amber-100 text-amber-700',
  admin: 'bg-red-100 text-red-700',
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

// ---------------------------------------------------------------------------
// Skeletons
// ---------------------------------------------------------------------------

function TableRowSkeleton() {
  return (
    <tr className="animate-pulse">
      <td className="px-6 py-4"><div className="h-4 w-32 rounded bg-slate-200" /></td>
      <td className="px-6 py-4"><div className="h-4 w-40 rounded bg-slate-200" /></td>
      <td className="px-6 py-4"><div className="h-5 w-14 rounded-full bg-slate-200" /></td>
      <td className="px-6 py-4"><div className="h-4 w-12 rounded bg-slate-200" /></td>
      <td className="px-6 py-4"><div className="h-4 w-8 rounded bg-slate-200" /></td>
      <td className="px-6 py-4"><div className="h-4 w-16 rounded bg-slate-200" /></td>
      <td className="px-6 py-4"><div className="h-4 w-20 rounded bg-slate-200" /></td>
    </tr>
  )
}

// ---------------------------------------------------------------------------
// Expanded User Row
// ---------------------------------------------------------------------------

function UserExpandedDetails({ user }: { user: UserRecord }) {
  return (
    <tr>
      <td colSpan={7} className="bg-slate-50 px-6 py-4">
        <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
          <div>
            <p className="font-medium text-slate-500">Full Name</p>
            <p className="text-slate-900">{user.full_name || 'N/A'}</p>
          </div>
          <div>
            <p className="font-medium text-slate-500">Email</p>
            <p className="text-slate-900">{user.email}</p>
          </div>
          <div>
            <p className="font-medium text-slate-500">Role</p>
            <p className="text-slate-900 capitalize">{user.role}</p>
          </div>
          <div>
            <p className="font-medium text-slate-500">User ID</p>
            <p className="truncate text-slate-900 font-mono text-xs">{user.id}</p>
          </div>
          <div>
            <p className="font-medium text-slate-500">Age Range</p>
            <p className="text-slate-900">{user.age_range || 'N/A'}</p>
          </div>
          <div>
            <p className="font-medium text-slate-500">COPPA Verified</p>
            <p className="text-slate-900">{user.coppa_verified ? 'Yes' : 'No'}</p>
          </div>
          <div>
            <p className="font-medium text-slate-500">Subscription</p>
            <p className="text-slate-900 capitalize">{user.subscription_tier || 'Free'}</p>
          </div>
          <div>
            <p className="font-medium text-slate-500">Joined</p>
            <p className="text-slate-900">{formatDate(user.created_at)}</p>
          </div>
        </div>
      </td>
    </tr>
  )
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function UsersPage() {
  const [tab, setTab] = useState<TabKey>('all')
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [users, setUsers] = useState<UserRecord[]>([])
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const params = new URLSearchParams()
      if (tab !== 'all') params.set('role', tab)
      if (search) params.set('search', search)
      params.set('page', String(page))
      params.set('limit', String(PAGE_SIZE))

      const data = await apiFetch(`/api/users?${params.toString()}`)
      setUsers(data.users ?? data ?? [])
      setTotalPages(Math.max(1, Math.ceil((data.total ?? data.length ?? 0) / PAGE_SIZE)))
    } catch (err) {
      console.error('Failed to load users:', err)
      setError('Unable to load users. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [tab, search, page])

  useEffect(() => {
    fetchUsers()
  }, [fetchUsers])

  // Reset page when filters change
  useEffect(() => {
    setPage(1)
  }, [tab, search])

  // Debounced search
  useEffect(() => {
    const timeout = setTimeout(() => setSearch(searchInput), 400)
    return () => clearTimeout(timeout)
  }, [searchInput])

  // ---- Error state ----------------------------------------------------------
  if (error && !loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-center">
          <AlertCircle className="h-10 w-10 text-red-400" />
          <p className="text-slate-600">{error}</p>
          <button
            onClick={() => fetchUsers()}
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
        <h1 className="text-2xl font-bold text-slate-900">Users</h1>
        <p className="mt-1 text-sm text-slate-500">
          Manage user accounts, roles, and permissions.
        </p>
      </div>

      {/* Filters row */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
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

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search by name or email..."
            className="block w-full rounded-lg border border-slate-300 py-2 pl-10 pr-4 text-sm placeholder-slate-400 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 sm:w-72"
          />
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="px-6 py-3 text-left font-semibold text-slate-600">Name</th>
                <th className="px-6 py-3 text-left font-semibold text-slate-600">Email</th>
                <th className="px-6 py-3 text-left font-semibold text-slate-600">Role</th>
                <th className="px-6 py-3 text-left font-semibold text-slate-600">Age Range</th>
                <th className="px-6 py-3 text-left font-semibold text-slate-600">COPPA</th>
                <th className="px-6 py-3 text-left font-semibold text-slate-600">Subscription</th>
                <th className="px-6 py-3 text-left font-semibold text-slate-600">Joined</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                Array.from({ length: 8 }).map((_, i) => <TableRowSkeleton key={i} />)
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <Inbox className="h-10 w-10 text-slate-300" />
                      <p className="text-sm text-slate-400">No users found.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                users.map((user) => (
                  <>
                    <tr
                      key={user.id}
                      onClick={() => setExpandedId(expandedId === user.id ? null : user.id)}
                      className="cursor-pointer transition-colors hover:bg-slate-50"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-slate-900">{user.full_name || 'Unnamed'}</span>
                          {expandedId === user.id ? (
                            <ChevronUp className="h-3.5 w-3.5 text-slate-400" />
                          ) : (
                            <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-slate-600">{user.email}</td>
                      <td className="px-6 py-4">
                        <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${ROLE_COLORS[user.role] ?? 'bg-slate-100 text-slate-700'}`}>
                          {user.role}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-slate-600">{user.age_range || '—'}</td>
                      <td className="px-6 py-4">
                        {user.coppa_verified && (
                          <Shield className="h-4 w-4 text-green-500" />
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <span className="capitalize text-slate-600">{user.subscription_tier || 'Free'}</span>
                      </td>
                      <td className="px-6 py-4 text-slate-600">{formatDate(user.created_at)}</td>
                    </tr>
                    {expandedId === user.id && (
                      <UserExpandedDetails key={`${user.id}-details`} user={user} />
                    )}
                  </>
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
