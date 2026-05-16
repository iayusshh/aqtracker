'use client'

import { useState, useCallback } from 'react'
import { TrendingUp } from 'lucide-react'
import { cn, computeScore, computeTimelineScore } from '@/lib/utils'
import { ScoreBar } from '@/components/ui/score-bar'

type AchievementStatus = 'not_started' | 'on_track' | 'completed'

interface Goal {
  id: string
  title: string
  thrust_area: string
  uom_type: string
  target: string
  weightage: number
}

interface ExistingAchievement {
  actual_achievement: string
  status: AchievementStatus
  computed_score: number
}

interface AchievementFormProps {
  goal: Goal
  existing?: ExistingAchievement
  windowOpen: boolean
  onSave: (goalId: string, data: {
    actual_achievement: string
    status: AchievementStatus
    computed_score: number
  }) => void
}

const STATUS_OPTIONS: { value: AchievementStatus; label: string; color: string }[] = [
  { value: 'not_started', label: 'Not Started', color: 'bg-gray-100 text-gray-700 border-gray-300' },
  { value: 'on_track', label: 'On Track', color: 'bg-blue-100 text-blue-700 border-blue-300' },
  { value: 'completed', label: 'Completed', color: 'bg-emerald-100 text-emerald-700 border-emerald-300' },
]

function calcScore(uomType: string, target: string, actual: string): number {
  if (!actual) return 0
  if (uomType === 'timeline') {
    return computeTimelineScore(new Date(target), new Date(actual))
  }
  if (uomType === 'zero') {
    return parseFloat(actual) === 0 ? 100 : 0
  }
  const t = parseFloat(target)
  const a = parseFloat(actual)
  if (isNaN(t) || isNaN(a) || t === 0 || a === 0) return 0
  return computeScore(uomType, t, a)
}

export function AchievementForm({
  goal,
  existing,
  windowOpen,
  onSave,
}: AchievementFormProps) {
  const [status, setStatus] = useState<AchievementStatus>(existing?.status ?? 'not_started')
  const [actual, setActual] = useState(existing?.actual_achievement ?? '')
  const [dirty, setDirty] = useState(false)

  const score = calcScore(goal.uom_type, goal.target, actual)
  const targetNum = parseFloat(goal.target)
  const actualNum = parseFloat(actual) || 0

  const handleActualChange = useCallback((val: string) => {
    setActual(val)
    setDirty(true)
  }, [])

  const handleSave = () => {
    onSave(goal.id, { actual_achievement: actual, status, computed_score: score })
    setDirty(false)
  }

  const renderInput = () => {
    if (goal.uom_type === 'zero') {
      return (
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            disabled={!windowOpen}
            checked={actual === '0'}
            onChange={(e) => handleActualChange(e.target.checked ? '0' : '')}
            className="h-4 w-4 rounded border-gray-300 text-blue-600"
          />
          <span className="text-sm text-gray-700">Mark as zero (target achieved)</span>
        </label>
      )
    }
    if (goal.uom_type === 'timeline') {
      return (
        <input
          type="date"
          disabled={!windowOpen}
          value={actual}
          onChange={(e) => handleActualChange(e.target.value)}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:cursor-not-allowed"
        />
      )
    }
    return (
      <input
        type="number"
        disabled={!windowOpen}
        value={actual}
        onChange={(e) => handleActualChange(e.target.value)}
        placeholder={`Target: ${goal.target}`}
        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:cursor-not-allowed"
      />
    )
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-gray-400">{goal.thrust_area}</p>
          <h3 className="mt-0.5 font-semibold text-gray-900">{goal.title}</h3>
        </div>
        <span className="shrink-0 rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">
          {goal.weightage}% weight
        </span>
      </div>

      <div className="flex flex-wrap gap-2">
        {STATUS_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            disabled={!windowOpen}
            onClick={() => { setStatus(opt.value); setDirty(true) }}
            className={cn(
              'rounded-full border px-3 py-1 text-xs font-medium transition-all',
              status === opt.value ? opt.color : 'border-gray-200 bg-white text-gray-500 hover:bg-gray-50',
              !windowOpen && 'cursor-not-allowed opacity-50'
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-medium text-gray-600">
          Actual Achievement
          <span className="ml-1 text-gray-400">({goal.uom_type})</span>
        </label>
        {renderInput()}
      </div>

      {goal.uom_type !== 'zero' && goal.uom_type !== 'timeline' && (
        <ScoreBar
          planned={isNaN(targetNum) ? 0 : targetNum}
          actual={actualNum}
          label="Planned vs Actual"
        />
      )}

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TrendingUp size={15} className={cn(score >= 80 ? 'text-emerald-500' : score >= 50 ? 'text-amber-500' : 'text-red-400')} />
          <span className="text-sm font-semibold">
            Score: <span className={cn(
              score >= 80 ? 'text-emerald-600' : score >= 50 ? 'text-amber-600' : 'text-red-500'
            )}>{score.toFixed(1)}%</span>
          </span>
        </div>
        {windowOpen && (
          <button
            onClick={handleSave}
            disabled={!dirty}
            className={cn(
              'rounded-lg px-4 py-1.5 text-sm font-medium transition-colors',
              dirty
                ? 'bg-blue-600 text-white hover:bg-blue-700'
                : 'bg-gray-100 text-gray-400 cursor-not-allowed'
            )}
          >
            Save
          </button>
        )}
      </div>
    </div>
  )
}
