'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2, Send, CheckCircle } from 'lucide-react'

interface GoalSummary {
  id: string
  status: string
  weightage: number
}

type ActionType = 'delete' | 'submit' | 'submit-all'

interface GoalActionsProps {
  type: ActionType
  goalId?: string
  cycleId?: string
  goals?: GoalSummary[]
  disabled?: boolean
  disabledReason?: string
}

export function GoalActions({ type, goalId, goals, disabled, disabledReason }: GoalActionsProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleDelete() {
    if (!confirm('Delete this goal? This cannot be undone.')) return
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/goals/${goalId}`, { method: 'DELETE' })
      if (!res.ok) {
        const json = await res.json()
        setError(json.error ?? 'Failed to delete')
        return
      }
      router.refresh()
    } catch {
      setError('Network error')
    } finally {
      setLoading(false)
    }
  }

  async function handleSubmit() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/goals/${goalId}/submit`, { method: 'POST' })
      const json = await res.json()
      if (!res.ok) {
        setError(json.error ?? 'Failed to submit')
        return
      }
      router.refresh()
    } catch {
      setError('Network error')
    } finally {
      setLoading(false)
    }
  }

  async function handleSubmitAll() {
    if (!goals) return
    const submittable = goals.filter((g) => g.status === 'draft' || g.status === 'returned')
    if (!submittable.length) return

    setLoading(true)
    setError('')
    try {
      const results = await Promise.allSettled(
        submittable.map((g) =>
          fetch(`/api/goals/${g.id}/submit`, { method: 'POST' })
        )
      )
      const failed = results.filter((r) => r.status === 'rejected').length
      if (failed > 0) setError(`${failed} goal(s) failed to submit`)
      router.refresh()
    } catch {
      setError('Network error')
    } finally {
      setLoading(false)
    }
  }

  if (type === 'delete') {
    return (
      <div>
        <button
          onClick={handleDelete}
          disabled={loading}
          className="inline-flex items-center gap-1 rounded-md border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
        >
          <Trash2 className="w-3.5 h-3.5" />
          {loading ? 'Deleting...' : 'Delete'}
        </button>
        {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
      </div>
    )
  }

  if (type === 'submit') {
    return (
      <div>
        <button
          onClick={handleSubmit}
          disabled={loading}
          className="inline-flex items-center gap-1 rounded-md bg-blue-50 border border-blue-200 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100 transition-colors disabled:opacity-50"
        >
          <Send className="w-3.5 h-3.5" />
          {loading ? 'Submitting...' : 'Submit'}
        </button>
        {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
      </div>
    )
  }

  // type === 'submit-all'
  return (
    <div>
      <button
        onClick={handleSubmitAll}
        disabled={loading || disabled}
        title={disabled ? disabledReason : undefined}
        className="inline-flex items-center gap-2 rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        <CheckCircle className="w-4 h-4" />
        {loading ? 'Submitting...' : 'Submit All'}
      </button>
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
      {disabled && disabledReason && (
        <p className="text-xs text-amber-600 mt-1">{disabledReason}</p>
      )}
    </div>
  )
}
