'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'

interface CycleFormData {
  name: string
  phase: string
  window_open: string
  window_close: string
  status: string
}

interface CycleFormProps {
  initial?: Partial<CycleFormData>
  onSubmit: (data: CycleFormData) => Promise<void>
  onCancel: () => void
  submitLabel?: string
}

const PHASES = [
  { value: 'goal_setting', label: 'Goal Setting (May–Jun)' },
  { value: 'q1', label: 'Q1 (Jul–Sep)' },
  { value: 'q2', label: 'Q2 (Oct–Dec)' },
  { value: 'q3', label: 'Q3 (Jan–Mar)' },
  { value: 'q4_annual', label: 'Q4 / Annual (Mar–Apr)' },
]

const STATUSES = [
  { value: 'draft', label: 'Draft' },
  { value: 'active', label: 'Active' },
  { value: 'closed', label: 'Closed' },
]

export function CycleForm({ initial, onSubmit, onCancel, submitLabel = 'Save' }: CycleFormProps) {
  const [data, setData] = useState<CycleFormData>({
    name: initial?.name ?? '',
    phase: initial?.phase ?? 'goal_setting',
    window_open: initial?.window_open?.slice(0, 10) ?? '',
    window_close: initial?.window_close?.slice(0, 10) ?? '',
    status: initial?.status ?? 'draft',
  })
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const set = (key: keyof CycleFormData) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setData((d) => ({ ...d, [key]: e.target.value }))

  const handleSubmit = async () => {
    if (!data.name.trim() || !data.window_open || !data.window_close) {
      setError('All fields are required')
      return
    }
    if (new Date(data.window_open) >= new Date(data.window_close)) {
      setError('Open date must be before close date')
      return
    }
    setError(null)
    setSubmitting(true)
    try {
      await onSubmit(data)
    } catch (e: any) {
      setError(e.message ?? 'Failed to save')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Cycle Name</label>
        <input
          type="text"
          value={data.name}
          onChange={set('name')}
          placeholder="e.g. FY2026-Q1"
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Phase</label>
        <select
          value={data.phase}
          onChange={set('phase')}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {PHASES.map((p) => (
            <option key={p.value} value={p.value}>{p.label}</option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Window Open</label>
          <input
            type="date"
            value={data.window_open}
            onChange={set('window_open')}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Window Close</label>
          <input
            type="date"
            value={data.window_close}
            onChange={set('window_close')}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
        <select
          value={data.status}
          onChange={set('status')}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {STATUSES.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}

      <div className="flex justify-end gap-3 pt-2">
        <button
          onClick={onCancel}
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          disabled={submitting}
          className={cn(
            'rounded-lg px-4 py-2 text-sm font-medium transition-colors',
            submitting
              ? 'bg-blue-300 text-white cursor-not-allowed'
              : 'bg-blue-600 text-white hover:bg-blue-700'
          )}
        >
          {submitting ? 'Saving…' : submitLabel}
        </button>
      </div>
    </div>
  )
}
