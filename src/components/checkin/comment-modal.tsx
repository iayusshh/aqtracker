'use client'

import { useState } from 'react'
import { Modal } from '@/components/ui/modal'
import { cn } from '@/lib/utils'

interface CommentModalProps {
  open: boolean
  onClose: () => void
  goalId: string
  goalTitle: string
  quarter: string
  onSuccess?: () => void
}

export function CommentModal({
  open,
  onClose,
  goalId,
  goalTitle,
  quarter,
  onSuccess,
}: CommentModalProps) {
  const [comment, setComment] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async () => {
    if (!comment.trim()) { setError('Comment cannot be empty'); return }
    setSubmitting(true)
    setError(null)

    const res = await fetch('/api/checkins', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ goal_id: goalId, quarter, comment }),
    })

    setSubmitting(false)
    if (!res.ok) {
      const d = await res.json()
      setError(d.error ?? 'Failed to submit comment')
      return
    }

    setComment('')
    onSuccess?.()
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title="Add Check-in Comment">
      <div className="space-y-4">
        <div>
          <p className="text-sm text-gray-500">Goal</p>
          <p className="font-medium text-gray-900">{goalTitle}</p>
          <p className="text-xs text-gray-400 mt-0.5">Quarter: {quarter.toUpperCase()}</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Comment
          </label>
          <textarea
            rows={4}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Add your feedback or observations..."
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
          {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
        </div>

        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
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
            {submitting ? 'Saving…' : 'Save Comment'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
