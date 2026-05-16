'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { CheckSquare, Send, Clock } from 'lucide-react'
import { cn, getQuarterWindow } from '@/lib/utils'
import { AchievementForm } from '@/components/checkin/achievement-form'
import { QuarterWindowIndicator } from '@/components/checkin/quarter-window-indicator'

type AchievementStatus = 'not_started' | 'on_track' | 'completed'

interface Goal {
  id: string
  title: string
  thrust_area: string
  uom_type: string
  target: string
  weightage: number
  status: string
}

interface Achievement {
  goal_id: string
  quarter: string
  actual_achievement: string
  status: AchievementStatus
  computed_score: number
}

function detectCurrentQuarter(): string {
  const now = new Date()
  const quarters = ['goal_setting', 'q1', 'q2', 'q3', 'q4_annual']
  for (const q of quarters) {
    const w = getQuarterWindow(q)
    if (now >= w.open && now <= w.close) return q
  }
  return 'q1'
}

export default function CheckinPage() {
  const [goals, setGoals] = useState<Goal[]>([])
  const [achievements, setAchievements] = useState<Record<string, Achievement>>({})
  const [pending, setPending] = useState<Record<string, Omit<Achievement, 'goal_id' | 'quarter'>>>({})
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)
  const currentQuarter = detectCurrentQuarter()
  const windowOpen = (() => {
    const w = getQuarterWindow(currentQuarter)
    const now = new Date()
    return now >= w.open && now <= w.close
  })()

  const showToast = (type: 'success' | 'error', msg: string) => {
    setToast({ type, msg })
    setTimeout(() => setToast(null), 3500)
  }

  useEffect(() => {
    const supabase = createClient()
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const [goalsRes, achRes] = await Promise.all([
        supabase
          .from('goals')
          .select('id, title, thrust_area, uom_type, target, weightage, status')
          .eq('employee_id', user.id)
          .in('status', ['approved', 'locked']),
        supabase
          .from('goal_achievements')
          .select('goal_id, quarter, actual_achievement, status, computed_score')
          .eq('quarter', currentQuarter),
      ])

      if (goalsRes.data) setGoals(goalsRes.data as Goal[])
      if (achRes.data) {
        const map: Record<string, Achievement> = {}
        for (const a of achRes.data as Achievement[]) map[a.goal_id] = a
        setAchievements(map)
      }
      setLoading(false)
    }
    load()
  }, [currentQuarter])

  const handleSaveDraft = useCallback((
    goalId: string,
    data: { actual_achievement: string; status: AchievementStatus; computed_score: number }
  ) => {
    setPending((prev) => ({ ...prev, [goalId]: data }))
    showToast('success', 'Draft saved locally')
  }, [])

  const submitAll = useCallback(async () => {
    setSubmitting(true)
    const entries = Object.entries(pending)
    if (!entries.length) {
      showToast('error', 'No changes to submit')
      setSubmitting(false)
      return
    }

    let hasError = false
    for (const [goal_id, data] of entries) {
      const res = await fetch('/api/achievements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ goal_id, quarter: currentQuarter, ...data }),
      })
      if (!res.ok) {
        const err = await res.json()
        showToast('error', err.error ?? 'Failed to submit')
        hasError = true
        break
      }
      const saved = await res.json()
      setAchievements((prev) => ({ ...prev, [goal_id]: saved }))
    }

    if (!hasError) {
      setPending({})
      showToast('success', `${entries.length} achievement(s) submitted`)
    }
    setSubmitting(false)
  }, [pending, currentQuarter])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-4xl px-4 py-8">
        <div className="mb-6 flex items-center gap-3">
          <CheckSquare className="text-blue-600" size={24} />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Quarterly Check-in</h1>
            <p className="text-sm text-gray-500">Update your goal progress for the current quarter</p>
          </div>
        </div>

        <QuarterWindowIndicator quarter={currentQuarter} className="mb-6" />

        {!windowOpen && (
          <div className="mb-4 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-amber-700">
            <Clock size={16} />
            <span className="text-sm">Check-in window is not currently open. You can view but not edit.</span>
          </div>
        )}

        {goals.length === 0 ? (
          <div className="rounded-xl border border-gray-200 bg-white py-16 text-center">
            <p className="text-gray-500">No approved goals found for this cycle.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {goals.map((goal) => {
              const existing = achievements[goal.id]
              const draftData = pending[goal.id]
              const displayExisting = draftData
                ? { ...existing, ...draftData, goal_id: goal.id, quarter: currentQuarter }
                : existing
              return (
                <AchievementForm
                  key={goal.id}
                  goal={goal}
                  existing={displayExisting}
                  windowOpen={windowOpen}
                  onSave={handleSaveDraft}
                />
              )
            })}
          </div>
        )}

        {windowOpen && goals.length > 0 && (
          <div className="mt-6 flex justify-end gap-3">
            <span className="self-center text-sm text-gray-500">
              {Object.keys(pending).length} unsaved change(s)
            </span>
            <button
              onClick={submitAll}
              disabled={submitting || Object.keys(pending).length === 0}
              className={cn(
                'flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-medium transition-colors',
                submitting || Object.keys(pending).length === 0
                  ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              )}
            >
              <Send size={15} />
              {submitting ? 'Submitting…' : 'Submit All'}
            </button>
          </div>
        )}
      </div>

      {toast && (
        <div
          className={cn(
            'fixed bottom-4 right-4 z-50 rounded-lg px-4 py-3 text-sm font-medium shadow-lg',
            toast.type === 'success'
              ? 'bg-emerald-600 text-white'
              : 'bg-red-600 text-white'
          )}
        >
          {toast.msg}
        </div>
      )}
    </div>
  )
}
