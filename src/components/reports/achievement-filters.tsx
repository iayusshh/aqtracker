'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { useCallback } from 'react'
import { Filter, ChevronDown, X } from 'lucide-react'
import { cn } from '@/lib/utils'

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

function PillSelect({
  value,
  onChange,
  placeholder,
  options,
}: {
  value: string
  onChange: (v: string) => void
  placeholder: string
  options: { label: string; value: string }[]
}) {
  const hasValue = Boolean(value)
  return (
    <div className="relative inline-flex items-center">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          'appearance-none rounded-full border px-3 py-1.5 pr-8 text-sm transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500/30',
          hasValue
            ? 'border-indigo-300 bg-indigo-50 text-indigo-700 font-medium'
            : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
        )}
      >
        <option value="">{placeholder}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      <ChevronDown size={13} className="pointer-events-none absolute right-2.5 text-slate-400" />
    </div>
  )
}

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
  const hasFilters = current.department || current.cycle_id || current.quarter || current.status

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex items-center gap-1.5 text-xs font-medium text-slate-400">
        <Filter size={12} />
        Filter
      </div>

      <PillSelect
        value={current.department ?? ''}
        onChange={(v) => updateParam('department', v)}
        placeholder="All Departments"
        options={departments.map((d) => ({ label: d, value: d }))}
      />

      <PillSelect
        value={current.cycle_id ?? ''}
        onChange={(v) => updateParam('cycle_id', v)}
        placeholder="All Cycles"
        options={cycles.map((c) => ({ label: c.name, value: c.id }))}
      />

      <PillSelect
        value={current.quarter ?? ''}
        onChange={(v) => updateParam('quarter', v)}
        placeholder="All Quarters"
        options={QUARTERS.map((q) => ({ label: q.toUpperCase(), value: q }))}
      />

      <PillSelect
        value={current.status ?? ''}
        onChange={(v) => updateParam('status', v)}
        placeholder="All Statuses"
        options={STATUSES.map((s) => ({ label: s.replace('_', ' '), value: s }))}
      />

      {hasFilters && (
        <button
          onClick={clearAll}
          className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-500 hover:bg-slate-50 transition-colors"
        >
          <X size={11} />
          Clear
        </button>
      )}
    </div>
  )
}
