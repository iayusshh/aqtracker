'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { useCallback } from 'react'
import { Filter, ChevronDown, X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface AuditLogFiltersProps {
  tableNames: string[]
  current: {
    table_name?: string
    change_type?: string
    date_from?: string
    date_to?: string
    page?: string
  }
}

const CHANGE_TYPES = ['insert', 'update', 'delete']

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
          'appearance-none rounded-full border px-3 py-1.5 pr-8 text-sm transition-all focus:outline-none focus:ring-2 focus:ring-slate-500/20',
          hasValue
            ? 'border-slate-400 bg-slate-100 text-slate-800 font-medium'
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

function DateInput({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-xs text-slate-400 font-medium">{label}</span>
      <input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-600 focus:outline-none focus:ring-2 focus:ring-slate-500/20 hover:border-slate-300 transition-colors"
      />
    </div>
  )
}

export function AuditLogFilters({ tableNames, current }: AuditLogFiltersProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const updateParam = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString())
      if (value) params.set(key, value)
      else params.delete(key)
      params.delete('page')
      router.push(`${pathname}?${params.toString()}`)
    },
    [router, pathname, searchParams]
  )

  const clearAll = () => router.push(pathname)

  const hasFilters =
    current.table_name || current.change_type || current.date_from || current.date_to

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex items-center gap-1.5 text-xs font-medium text-slate-400">
        <Filter size={12} />
        Filter
      </div>

      <PillSelect
        value={current.table_name ?? ''}
        onChange={(v) => updateParam('table_name', v)}
        placeholder="All Tables"
        options={tableNames.map((t) => ({ label: t, value: t }))}
      />

      <PillSelect
        value={current.change_type ?? ''}
        onChange={(v) => updateParam('change_type', v)}
        placeholder="All Actions"
        options={CHANGE_TYPES.map((t) => ({ label: t, value: t }))}
      />

      <DateInput
        label="From"
        value={current.date_from ?? ''}
        onChange={(v) => updateParam('date_from', v)}
      />

      <DateInput
        label="To"
        value={current.date_to ?? ''}
        onChange={(v) => updateParam('date_to', v)}
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
