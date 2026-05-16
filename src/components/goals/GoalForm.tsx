'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { THRUST_AREA_SUGGESTIONS, validateGoalForm } from '@/lib/goals'
import type { GoalFormData } from '@/lib/goals'
import type { UomType } from '@/types'

/** Supabase-returned goal row shape (snake_case) */
interface GoalRow {
  id: string
  cycle_id: string
  thrust_area: string
  title: string
  description: string | null
  uom_type: UomType
  target: string
  weightage: number
  status: string
  is_shared: boolean
}

interface GoalFormProps {
  /** When provided, the form operates in edit mode */
  goal?: GoalRow
  cycleId: string
  usedWeightage: number
  /** When editing, exclude current goal's weightage from the used total */
  currentGoalWeightage?: number
  isShared?: boolean
}

const UOM_OPTIONS: { value: UomType; label: string }[] = [
  { value: 'min_numeric', label: 'Min Numeric' },
  { value: 'max_numeric', label: 'Max Numeric' },
  { value: 'min_percent', label: 'Min %' },
  { value: 'max_percent', label: 'Max %' },
  { value: 'timeline', label: 'Timeline' },
  { value: 'zero', label: 'Zero Incidents' },
]

const WEIGHTAGE_OPTIONS = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100]

export function GoalForm({
  goal,
  cycleId,
  usedWeightage,
  currentGoalWeightage = 0,
  isShared = false,
}: GoalFormProps) {
  const router = useRouter()
  const isEdit = Boolean(goal)

  const [form, setForm] = useState<GoalFormData>({
    thrustArea: goal?.thrust_area ?? '',
    title: goal?.title ?? '',
    description: goal?.description ?? '',
    uomType: goal?.uom_type ?? 'max_numeric',
    target: goal?.target === 'N/A' ? '' : (goal?.target ?? ''),
    weightage: goal?.weightage ?? 10,
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [serverError, setServerError] = useState('')
  const [thrustSuggestOpen, setThrustSuggestOpen] = useState(false)

  const available = 100 - usedWeightage + currentGoalWeightage

  function set<K extends keyof GoalFormData>(key: K, value: GoalFormData[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
    setErrors((prev) => ({ ...prev, [key]: '' }))
  }

  // Reset target when UoM changes
  useEffect(() => {
    if (form.uomType === 'zero') set('target', 'N/A')
    else if (form.target === 'N/A') set('target', '')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.uomType])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const validation = validateGoalForm(form, usedWeightage, currentGoalWeightage)
    if (!validation.valid) {
      setErrors(validation.errors)
      return
    }

    setSaving(true)
    setServerError('')

    try {
      const url = isEdit ? `/api/goals/${goal!.id}` : '/api/goals'
      const method = isEdit ? 'PATCH' : 'POST'
      const body = isEdit ? form : { ...form, cycle_id: cycleId }

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json()

      if (!res.ok) {
        if (json.errors) setErrors(json.errors)
        setServerError(json.error ?? 'Something went wrong')
        return
      }

      router.push('/goals')
      router.refresh()
    } catch {
      setServerError('Network error. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const isNumericOrPercent = ['min_numeric', 'max_numeric', 'min_percent', 'max_percent'].includes(form.uomType)
  const isTimeline = form.uomType === 'timeline'
  const isZero = form.uomType === 'zero'

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl">
      {serverError && (
        <div className="rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-700">
          {serverError}
        </div>
      )}

      {/* Thrust Area */}
      <div className="relative">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Thrust Area <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={form.thrustArea}
          onChange={(e) => set('thrustArea', e.target.value)}
          onFocus={() => setThrustSuggestOpen(true)}
          onBlur={() => setTimeout(() => setThrustSuggestOpen(false), 150)}
          disabled={isShared}
          placeholder="e.g. Revenue"
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
        />
        {thrustSuggestOpen && !isShared && (
          <ul className="absolute z-10 mt-1 w-full rounded-md border border-gray-200 bg-white shadow-lg">
            {THRUST_AREA_SUGGESTIONS.filter((s) =>
              s.toLowerCase().includes(form.thrustArea.toLowerCase())
            ).map((s) => (
              <li
                key={s}
                onMouseDown={() => set('thrustArea', s)}
                className="cursor-pointer px-3 py-2 text-sm hover:bg-blue-50"
              >
                {s}
              </li>
            ))}
          </ul>
        )}
        {errors.thrustArea && <p className="mt-1 text-xs text-red-600">{errors.thrustArea}</p>}
      </div>

      {/* Title */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Goal Title <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={form.title}
          onChange={(e) => set('title', e.target.value)}
          disabled={isShared}
          placeholder="Enter a clear, measurable goal title"
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
        />
        {errors.title && <p className="mt-1 text-xs text-red-600">{errors.title}</p>}
      </div>

      {/* Description */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
        <textarea
          rows={3}
          value={form.description}
          onChange={(e) => set('description', e.target.value)}
          disabled={isShared}
          placeholder="Additional context or measurement criteria"
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed resize-none"
        />
      </div>

      {/* UoM Type */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Unit of Measurement <span className="text-red-500">*</span>
        </label>
        <select
          value={form.uomType}
          onChange={(e) => set('uomType', e.target.value as UomType)}
          disabled={isShared}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
        >
          {UOM_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        {errors.uomType && <p className="mt-1 text-xs text-red-600">{errors.uomType}</p>}
      </div>

      {/* Target */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Target {!isZero && <span className="text-red-500">*</span>}
        </label>
        {isZero ? (
          <div className="w-full rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-500">
            0 = Success (no incidents)
          </div>
        ) : isTimeline ? (
          <input
            type="date"
            value={form.target}
            onChange={(e) => set('target', e.target.value)}
            disabled={isShared}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
          />
        ) : (
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={0}
              step={isNumericOrPercent ? (form.uomType.includes('percent') ? 0.1 : 1) : undefined}
              value={form.target}
              onChange={(e) => set('target', e.target.value)}
              disabled={isShared}
              placeholder={form.uomType.includes('percent') ? 'e.g. 85.5' : 'e.g. 120'}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
            />
            {form.uomType.includes('percent') && (
              <span className="text-sm text-gray-500 shrink-0">%</span>
            )}
          </div>
        )}
        {errors.target && <p className="mt-1 text-xs text-red-600">{errors.target}</p>}
      </div>

      {/* Weightage */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Weightage <span className="text-red-500">*</span>
        </label>
        <div className="flex items-center gap-3">
          <select
            value={form.weightage}
            onChange={(e) => set('weightage', Number(e.target.value))}
            className="w-40 rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {WEIGHTAGE_OPTIONS.filter((w) => w <= available || w === form.weightage).map((w) => (
              <option key={w} value={w}>{w}%</option>
            ))}
          </select>
          <p className="text-sm text-gray-500">
            {available}% available
          </p>
        </div>
        {errors.weightage && <p className="mt-1 text-xs text-red-600">{errors.weightage}</p>}
      </div>

      {isShared && (
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
          This is a shared goal. Only weightage can be modified.
        </p>
      )}

      {/* Actions */}
      <div className="flex items-center gap-3 pt-2">
        <button
          type="submit"
          disabled={saving}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {saving ? 'Saving...' : isEdit ? 'Save Changes' : 'Create Goal'}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}
