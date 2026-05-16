'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { useCallback } from 'react'
import { Filter } from 'lucide-react'

interface Cycle { id: string; name: string }

interface AchievementFiltersProps {
  departments: string[]
  cycles: Cycle[]
  current: {
    department?: string
    cycle_id?: string
    quarter?: string
    status?: string
  }
}

const QUARTERS = ['q1', 'q2', 'q3', 'q4']
const STATUSES = ['not_started', 'on_track', 'completed']

export function AchievementFilters({ departments, cycles, current }: AchievementFiltersProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const updateParam = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString())
      if (value) params.set(key, value)
      else params.delete(key)
      router.push(`${pathname}?${params.toString()}`)
    },
    [router, pathname, searchParams]
  )

  const clearAll = () => router.push(pathname)

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1.5 text-sm font-medium text-gray-600">
          <Filter size={14} />
          Filters
        </div>

        <select
          value={current.department ?? ''}
          onChange={(e) => updateParam('department', e.target.value)}
          className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Departments</option>
          {departments.map((d) => (
            <option key={d} value={d}>{d}</option>
          ))}
        </select>

        <select
          value={current.cycle_id ?? ''}
          onChange={(e) => updateParam('cycle_id', e.target.value)}
          className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Cycles</option>
          {cycles.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>

        <select
          value={current.quarter ?? ''}
          onChange={(e) => updateParam('quarter', e.target.value)}
          className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Quarters</option>
          {QUARTERS.map((q) => (
            <option key={q} value={q}>{q.toUpperCase()}</option>
          ))}
        </select>

        <select
          value={current.status ?? ''}
          onChange={(e) => updateParam('status', e.target.value)}
          className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>{s.replace('_', ' ')}</option>
          ))}
        </select>

        {(current.department || current.cycle_id || current.quarter || current.status) && (
          <button
            onClick={clearAll}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-500 hover:bg-gray-50 transition-colors"
          >
            Clear all
          </button>
        )}
      </div>
    </div>
  )
}
