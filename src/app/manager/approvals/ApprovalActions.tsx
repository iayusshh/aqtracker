'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle, XCircle, CheckSquare } from 'lucide-react'

type ActionType = 'approve' | 'return' | 'approve-all'

interface ApprovalActionsProps {
  type: ActionType
  goalId?: string
  goalIds?: string[]
  employeeId?: string
  currentWeightage?: number
}

export function ApprovalActions({ type, goalId, goalIds, currentWeightage }: ApprovalActionsProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showReturnModal, setShowReturnModal] = useState(false)
  const [returnComment, setReturnComment] = useState('')
  const [weightage, setWeightage] = useState(currentWeightage ?? 10)

  async function handleApprove() {
    if (!goalId) return
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/goals/${goalId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ weightage }),
      })
      const json = await res.json()
      if (!res.ok) { setError(json.error ?? 'Failed to approve'); return }
      router.refresh()
    } catch {
      setError('Network error')
    } finally {
      setLoading(false)
    }
  }

  async function handleApproveAll() {
    if (!goalIds?.length) return
    setLoading(true)
    setError('')
    try {
      const results = await Promise.allSettled(
        goalIds.map((id) =>
          fetch(`/api/goals/${id}/approve`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({}),
          })
        )
      )
      const failed = results.filter((r) => r.status === 'rejected').length
      if (failed) setError(`${failed} goal(s) failed to approve`)
      router.refresh()
    } catch {
      setError('Network error')
    } finally {
      setLoading(false)
    }
  }

  async function handleReturn() {
    if (!goalId || !returnComment.trim()) return
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/goals/${goalId}/return`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comment: returnComment }),
      })
      const json = await res.json()
      if (!res.ok) { setError(json.error ?? 'Failed to return'); return }
      setShowReturnModal(false)
      setReturnComment('')
      router.refresh()
    } catch {
      setError('Network error')
    } finally {
      setLoading(false)
    }
  }

  if (type === 'approve-all') {
    return (
      <div>
        <button
          onClick={handleApproveAll}
          disabled={loading}
          className="inline-flex items-center gap-1.5 rounded-md bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50 transition-colors"
        >
          <CheckSquare className="w-3.5 h-3.5" />
          {loading ? 'Approving...' : 'Approve All'}
        </button>
        {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
      </div>
    )
  }

  if (type === 'return') {
    return (
      <div>
        <button
          onClick={() => setShowReturnModal(true)}
          disabled={loading}
          className="inline-flex items-center gap-1 rounded-md border border-red-200 px-2.5 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
        >
          <XCircle className="w-3.5 h-3.5" />
          Return
        </button>

        {/* Return Modal */}
        {showReturnModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
            <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md mx-4">
              <h3 className="font-semibold text-gray-900 mb-3">Return Goal for Revision</h3>
              <p className="text-sm text-gray-600 mb-4">
                Provide a comment explaining why this goal is being returned. The employee will be able to edit and resubmit.
              </p>
              <textarea
                rows={4}
                value={returnComment}
                onChange={(e) => setReturnComment(e.target.value)}
                placeholder="e.g. Please clarify the target metric and measurement method..."
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
              {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
              <div className="flex items-center gap-3 mt-4">
                <button
                  onClick={handleReturn}
                  disabled={loading || !returnComment.trim()}
                  className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50 transition-colors"
                >
                  {loading ? 'Returning...' : 'Return Goal'}
                </button>
                <button
                  onClick={() => { setShowReturnModal(false); setReturnComment(''); setError('') }}
                  className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  // type === 'approve'
  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-1">
        <label className="text-xs text-gray-500">Wt:</label>
        <input
          type="number"
          min={10}
          max={100}
          step={10}
          value={weightage}
          onChange={(e) => setWeightage(Number(e.target.value))}
          className="w-16 rounded border border-gray-300 px-1.5 py-1 text-xs text-center focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        <span className="text-xs text-gray-500">%</span>
      </div>
      <button
        onClick={handleApprove}
        disabled={loading}
        className="inline-flex items-center gap-1 rounded-md bg-green-50 border border-green-200 px-2.5 py-1.5 text-xs font-medium text-green-700 hover:bg-green-100 disabled:opacity-50 transition-colors"
      >
        <CheckCircle className="w-3.5 h-3.5" />
        {loading ? 'Approving...' : 'Approve'}
      </button>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  )
}
