'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { THRUST_AREA_SUGGESTIONS } from '@/lib/goals'
import { Share2 } from 'lucide-react'
import type { UomType } from '@/types'

interface EmployeeOption {
  id: string
  full_name: string
  email: string
  department: string | null
}

interface SharedGoalFormProps {
  cycleId: string
  employees: EmployeeOption[]
}

const UOM_OPTIONS: { value: UomType; label: string }[] = [
  { value: 'min_numeric', label: 'Min Numeric' },
  { value: 'max_numeric', label: 'Max Numeric' },
  { value: 'min_percent', label: 'Min %' },
  { value: 'max_percent', label: 'Max %' },
  { value: 'timeline', label: 'Timeline' },
  { value: 'zero', label: 'Zero Incidents' },
]

const WEIGHTAGE_OPTIONS = [10, 20, 30, 40, 50, 60, 70, 80, 90]

export function SharedGoalForm({ cycleId, employees }: SharedGoalFormProps) {
  const router = useRouter()

  const [form, setForm] = useState({
    thrustArea: '',
    title: '',
    description: '',
    uomType: 'max_numeric' as UomType,
    target: '',
    defaultWeightage: 10,
  })
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [departmentFilter, setDepartmentFilter] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [serverError, setServerError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  const departments = useMemo(() => {
    const deps = new Set(employees.map((e) => e.department).filter(Boolean) as string[])
    return Array.from(deps).sort()
  }, [employees])

  const filteredEmployees = departmentFilter
    ? employees.filter((e) => e.department === departmentFilter)
    : employees

  function setField<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
    setErrors((prev) => ({ ...prev, [key]: '' }))
  }

  function toggleEmployee(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function selectAll() {
    setSelectedIds(new Set(filteredEmployees.map((e) => e.id)))
  }

  function clearAll() {
    setSelectedIds(new Set())
  }

  function validate() {
    const errs: Record<string, string> = {}
    if (!form.thrustArea.trim()) errs.thrustArea = 'Required'
    if (!form.title.trim()) errs.title = 'Required'
    if (form.uomType !== 'zero' && !form.target.trim()) errs.target = 'Required'
    if (!form.defaultWeightage || form.defaultWeightage < 10) errs.defaultWeightage = 'Minimum 10%'
    if (selectedIds.size === 0) errs.employees = 'Select at least one employee'
    return errs
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length > 0) {
      setErrors(errs)
      return
    }

    setSaving(true)
    setServerError('')
    setSuccessMsg('')

    try {
      const res = await fetch('/api/admin/shared-goals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cycleId,
          thrustArea: form.thrustArea,
          title: form.title,
          description: form.description || undefined,
          uomType: form.uomType,
          target: form.uomType === 'zero' ? 'N/A' : form.target,
          defaultWeightage: form.defaultWeightage,
          employeeIds: Array.from(selectedIds),
        }),
      })

      const json = await res.json()
      if (!res.ok) {
        setServerError(json.error ?? 'Something went wrong')
        return
      }

      setSuccessMsg(`Shared goal pushed to ${json.created} employee(s) successfully.`)
      setForm({ thrustArea: '', title: '', description: '', uomType: 'max_numeric', target: '', defaultWeightage: 10 })
      setSelectedIds(new Set())
      router.refresh()
    } catch {
      setServerError('Network error. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const isZero = form.uomType === 'zero'
  const isTimeline = form.uomType === 'timeline'

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {serverError && (
        <div className="rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-700">{serverError}</div>
      )}
      {successMsg && (
        <div className="rounded-md bg-green-50 border border-green-200 p-3 text-sm text-green-700">{successMsg}</div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Thrust Area */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Thrust Area <span className="text-red-500">*</span>
          </label>
          <select
            value={form.thrustArea}
            onChange={(e) => setField('thrustArea', e.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Select area...</option>
            {THRUST_AREA_SUGGESTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          {errors.thrustArea && <p className="mt-1 text-xs text-red-600">{errors.thrustArea}</p>}
        </div>

        {/* UoM Type */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Unit of Measurement <span className="text-red-500">*</span>
          </label>
          <select
            value={form.uomType}
            onChange={(e) => setField('uomType', e.target.value as UomType)}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {UOM_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
      </div>

      {/* Title */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Goal Title <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={form.title}
          onChange={(e) => setField('title', e.target.value)}
          placeholder="Enter the shared goal title"
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        {errors.title && <p className="mt-1 text-xs text-red-600">{errors.title}</p>}
      </div>

      {/* Description */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
        <textarea
          rows={3}
          value={form.description}
          onChange={(e) => setField('description', e.target.value)}
          placeholder="Describe the shared goal and its context"
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Target */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Target {!isZero && <span className="text-red-500">*</span>}
            <span className="ml-1 text-xs text-gray-400">(read-only for recipients)</span>
          </label>
          {isZero ? (
            <div className="w-full rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-500">
              0 = Success (no incidents)
            </div>
          ) : isTimeline ? (
            <input
              type="date"
              value={form.target}
              onChange={(e) => setField('target', e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          ) : (
            <input
              type="number"
              min={0}
              step={form.uomType.includes('percent') ? 0.1 : 1}
              value={form.target}
              onChange={(e) => setField('target', e.target.value)}
              placeholder={form.uomType.includes('percent') ? 'e.g. 90' : 'e.g. 500'}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          )}
          {errors.target && <p className="mt-1 text-xs text-red-600">{errors.target}</p>}
        </div>

        {/* Default Weightage */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Default Weightage <span className="text-red-500">*</span>
          </label>
          <select
            value={form.defaultWeightage}
            onChange={(e) => setField('defaultWeightage', Number(e.target.value))}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {WEIGHTAGE_OPTIONS.map((w) => <option key={w} value={w}>{w}%</option>)}
          </select>
          {errors.defaultWeightage && <p className="mt-1 text-xs text-red-600">{errors.defaultWeightage}</p>}
        </div>
      </div>

      {/* Employee Multi-Select */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-medium text-gray-700">
            Select Employees <span className="text-red-500">*</span>
          </label>
          <div className="flex items-center gap-4">
            {/* Department filter */}
            <select
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
              className="rounded border border-gray-300 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">All departments</option>
              {departments.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
            <button type="button" onClick={selectAll} className="text-xs text-blue-600 hover:underline">Select all</button>
            <button type="button" onClick={clearAll} className="text-xs text-gray-500 hover:underline">Clear</button>
          </div>
        </div>

        <div className="border border-gray-200 rounded-md max-h-60 overflow-y-auto">
          {filteredEmployees.length === 0 ? (
            <p className="text-sm text-gray-400 px-3 py-4 text-center">No employees found</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {filteredEmployees.map((emp) => (
                <li key={emp.id}>
                  <label className="flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(emp.id)}
                      onChange={() => toggleEmployee(emp.id)}
                      className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-900 truncate">{emp.full_name}</p>
                      <p className="text-xs text-gray-500 truncate">
                        {emp.email}{emp.department ? ` &bull; ${emp.department}` : ''}
                      </p>
                    </div>
                  </label>
                </li>
              ))}
            </ul>
          )}
        </div>

        <p className="mt-1.5 text-xs text-gray-500">
          {selectedIds.size} employee{selectedIds.size !== 1 ? 's' : ''} selected
        </p>
        {errors.employees && <p className="text-xs text-red-600 mt-1">{errors.employees}</p>}
      </div>

      <div className="flex items-center gap-3 pt-2 border-t border-gray-100">
        <button
          type="submit"
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-md bg-teal-600 px-5 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <Share2 className="w-4 h-4" />
          {saving ? 'Pushing...' : `Push to ${selectedIds.size || '...'} Employee${selectedIds.size !== 1 ? 's' : ''}`}
        </button>
      </div>
    </form>
  )
}
