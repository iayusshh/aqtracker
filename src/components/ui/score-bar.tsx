'use client'

import { cn } from '@/lib/utils'

interface ScoreBarProps {
  planned: number
  actual: number
  label?: string
  className?: string
}

export function ScoreBar({ planned, actual, label, className }: ScoreBarProps) {
  const max = Math.max(planned, actual, 1)
  const plannedPct = Math.min((planned / max) * 100, 100)
  const actualPct = Math.min((actual / max) * 100, 100)
  const isAhead = actual >= planned

  return (
    <div className={cn('space-y-1', className)}>
      {label && <p className="text-xs text-gray-500">{label}</p>}
      <div className="flex gap-2 items-center text-xs text-gray-600">
        <span className="w-12 text-right">Plan</span>
        <div className="flex-1 h-2.5 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-blue-400 rounded-full transition-all"
            style={{ width: `${plannedPct}%` }}
          />
        </div>
        <span className="w-8">{planned}</span>
      </div>
      <div className="flex gap-2 items-center text-xs text-gray-600">
        <span className="w-12 text-right">Actual</span>
        <div className="flex-1 h-2.5 bg-gray-100 rounded-full overflow-hidden">
          <div
            className={cn(
              'h-full rounded-full transition-all',
              isAhead ? 'bg-emerald-500' : 'bg-amber-400'
            )}
            style={{ width: `${actualPct}%` }}
          />
        </div>
        <span className="w-8">{actual}</span>
      </div>
    </div>
  )
}
