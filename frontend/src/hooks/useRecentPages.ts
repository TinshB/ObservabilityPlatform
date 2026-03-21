import { useState, useCallback } from 'react'

const STORAGE_KEY = 'obs-recent-pages'
const MAX_RECENT = 5

export interface RecentPage {
  path: string
  label: string
  visitedAt: number
}

function load(): RecentPage[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

/**
 * Tracks recently visited pages in localStorage.
 *
 * - Deduplicates by path (latest visit wins)
 * - Keeps at most MAX_RECENT entries
 * - Persists across sessions via `obs-recent-pages`
 */
export function useRecentPages() {
  const [pages, setPages] = useState<RecentPage[]>(load)

  const recordVisit = useCallback((path: string, label: string) => {
    setPages(prev => {
      const filtered = prev.filter(p => p.path !== path)
      const next = [{ path, label, visitedAt: Date.now() }, ...filtered].slice(0, MAX_RECENT)
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      } catch { /* quota exceeded — keep in-memory only */ }
      return next
    })
  }, [])

  return { recentPages: pages, recordVisit } as const
}
