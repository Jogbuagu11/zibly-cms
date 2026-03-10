'use client'

import { useState, useEffect, FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { Loader2, ArrowLeft, CheckCircle } from 'lucide-react'

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

interface Category {
  id: string
  name: string
  slug: string
  color: string
}

export default function CreateStoryPage() {
  const router = useRouter()

  const [categories, setCategories] = useState<Category[]>([])
  const [loadingCategories, setLoadingCategories] = useState(true)

  const [title, setTitle] = useState('')
  const [summary, setSummary] = useState('')
  const [masterContent, setMasterContent] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [coverImageUrl, setCoverImageUrl] = useState('')
  const [sourceUrl, setSourceUrl] = useState('')
  const [sourceName, setSourceName] = useState('')
  const [isBreaking, setIsBreaking] = useState(false)
  const [locationQueries, setLocationQueries] = useState('')
  const [photoSearchQueries, setPhotoSearchQueries] = useState('')

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    async function loadCategories() {
      try {
        const { data, error } = await supabase
          .from('categories')
          .select('id, name, slug, color')
          .order('name', { ascending: true })
        if (error) throw error
        setCategories(data ?? [])
      } catch (err: unknown) {
        console.error('Failed to load categories:', err)
      } finally {
        setLoadingCategories(false)
      }
    }
    loadCategories()
  }, [])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setSuccess('')
    setSubmitting(true)

    try {
      const payload: Record<string, unknown> = {
        title,
        summary,
        master_content: masterContent,
        category_id: categoryId,
        is_breaking: isBreaking,
      }

      if (coverImageUrl.trim()) payload.cover_image_url = coverImageUrl.trim()
      if (sourceUrl.trim()) payload.source_url = sourceUrl.trim()
      if (sourceName.trim()) payload.source_name = sourceName.trim()

      const locQArr = locationQueries.split(',').map((s) => s.trim()).filter(Boolean)
      if (locQArr.length > 0) payload.location_queries = locQArr

      const photoQArr = photoSearchQueries.split(',').map((s) => s.trim()).filter(Boolean)
      if (photoQArr.length > 0) payload.photo_search_queries = photoQArr

      await apiFetch('/api/stories', {
        method: 'POST',
        body: JSON.stringify(payload),
      })

      setSuccess('Story created successfully. Content pipeline started.')
      setTimeout(() => router.push('/stories'), 1500)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create story')
    } finally {
      setSubmitting(false)
    }
  }

  const inputClass =
    'block w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm placeholder-slate-400 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:bg-slate-50 disabled:text-slate-500'
  const labelClass = 'mb-1.5 block text-sm font-medium text-slate-700'

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href="/stories"
          className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-2xl font-bold text-slate-900">Create Story</h1>
      </div>

      {/* Form Card */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Error / Success */}
          {error && (
            <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
          )}
          {success && (
            <div className="flex items-center gap-2 rounded-lg bg-green-50 px-4 py-3 text-sm text-green-700">
              <CheckCircle className="h-4 w-4 flex-shrink-0" />
              {success}
            </div>
          )}

          {/* Title */}
          <div>
            <label htmlFor="title" className={labelClass}>
              Title <span className="text-red-500">*</span>
            </label>
            <input
              id="title"
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className={inputClass}
              placeholder="Enter story title"
              disabled={submitting}
            />
          </div>

          {/* Summary */}
          <div>
            <label htmlFor="summary" className={labelClass}>
              Summary
            </label>
            <textarea
              id="summary"
              rows={2}
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              className={inputClass}
              placeholder="Brief summary of the story"
              disabled={submitting}
            />
          </div>

          {/* Master Content */}
          <div>
            <label htmlFor="masterContent" className={labelClass}>
              Master Content <span className="text-red-500">*</span>
            </label>
            <textarea
              id="masterContent"
              rows={10}
              required
              value={masterContent}
              onChange={(e) => setMasterContent(e.target.value)}
              className={inputClass}
              placeholder="Paste the original article text here..."
              disabled={submitting}
            />
            <p className="mt-1 text-xs text-slate-400">
              The original article text. Age-range versions will be generated automatically.
            </p>
          </div>

          {/* Category */}
          <div>
            <label htmlFor="category" className={labelClass}>
              Category <span className="text-red-500">*</span>
            </label>
            {loadingCategories ? (
              <div className="flex items-center gap-2 text-sm text-slate-400">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading categories...
              </div>
            ) : (
              <select
                id="category"
                required
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className={inputClass}
                disabled={submitting}
              >
                <option value="">Select a category</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Cover Image URL */}
          <div>
            <label htmlFor="coverImageUrl" className={labelClass}>
              Cover Image URL
            </label>
            <input
              id="coverImageUrl"
              type="url"
              value={coverImageUrl}
              onChange={(e) => setCoverImageUrl(e.target.value)}
              className={inputClass}
              placeholder="https://example.com/image.jpg"
              disabled={submitting}
            />
          </div>

          {/* Source fields side-by-side */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="sourceUrl" className={labelClass}>
                Source URL
              </label>
              <input
                id="sourceUrl"
                type="url"
                value={sourceUrl}
                onChange={(e) => setSourceUrl(e.target.value)}
                className={inputClass}
                placeholder="https://source.com/article"
                disabled={submitting}
              />
            </div>
            <div>
              <label htmlFor="sourceName" className={labelClass}>
                Source Name
              </label>
              <input
                id="sourceName"
                type="text"
                value={sourceName}
                onChange={(e) => setSourceName(e.target.value)}
                className={inputClass}
                placeholder="e.g. Reuters, AP News"
                disabled={submitting}
              />
            </div>
          </div>

          {/* Is Breaking */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              role="switch"
              aria-checked={isBreaking}
              onClick={() => setIsBreaking(!isBreaking)}
              disabled={submitting}
              className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:ring-offset-2 disabled:opacity-50 ${
                isBreaking ? 'bg-red-500' : 'bg-slate-200'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  isBreaking ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
            <label className="text-sm font-medium text-slate-700">Breaking News</label>
          </div>

          {/* Location Queries */}
          <div>
            <label htmlFor="locationQueries" className={labelClass}>
              Location Queries
            </label>
            <input
              id="locationQueries"
              type="text"
              value={locationQueries}
              onChange={(e) => setLocationQueries(e.target.value)}
              className={inputClass}
              placeholder="New York, Washington DC, London"
              disabled={submitting}
            />
            <p className="mt-1 text-xs text-slate-400">
              Comma-separated locations to fetch map data for.
            </p>
          </div>

          {/* Photo Search Queries */}
          <div>
            <label htmlFor="photoSearchQueries" className={labelClass}>
              Photo Search Queries
            </label>
            <input
              id="photoSearchQueries"
              type="text"
              value={photoSearchQueries}
              onChange={(e) => setPhotoSearchQueries(e.target.value)}
              className={inputClass}
              placeholder="climate change, solar panels, renewable energy"
              disabled={submitting}
            />
            <p className="mt-1 text-xs text-slate-400">
              Comma-separated search terms for Unsplash photos.
            </p>
          </div>

          {/* Buttons */}
          <div className="flex flex-col gap-3 pt-2 sm:flex-row-reverse">
            <button
              type="submit"
              disabled={submitting}
              className="flex h-12 w-full items-center justify-center rounded-lg bg-blue-600 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating Story...
                </>
              ) : (
                'Create Story'
              )}
            </button>
            <Link
              href="/stories"
              className="flex h-12 w-full items-center justify-center rounded-lg border border-slate-300 text-sm font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50 sm:w-auto sm:px-6"
            >
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </div>
  )
}
