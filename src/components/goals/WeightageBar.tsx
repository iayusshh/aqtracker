'use client'

import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

interface WeightageBarProps {
  used: number
  total?: number
}

export function WeightageBar({ used, total = 100 }: WeightageBarProps) {
  const pct = Math.min((used / total) * 100, 100)
  const isComplete = used === total
  const isOver = used > total

  const fillClass = isOver
    ? 'bg-gradient-to-r from-red-400 to-red-600'
    : isComplete
    ? 'bg-gradient-to-r from-emerald-400 to-emerald-600'
    : 'bg-gradient-to-r from-indigo-400 to-indigo-600'

  const labelClass = isOver
    ? 'text-red-600'
    : isComplete
    ? 'text-emerald-600'
    : 'text-slate-700'

  return (
    <div className="w-full">
      {/* Labels */}
      <div className="flex justify-between text-sm mb-2">
        <span className={cn('font-medium', labelClass)}>
          {used}% allocated
        </span>
        <span className="text-slate-500">
          {isComplete ? 'Ready to submit' : `${total - used}% remaining`}
        </span>
      </div>

      {/* Track */}
      <div className="relative h-3 bg-slate-100 rounded-full overflow-hidden">
        {/* Animated fill */}
        <motion.div
          className={cn('h-full rounded-full', fillClass)}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        />

        {/* Tick marks at 25%, 50%, 75% */}
        {[25, 50, 75].map((tick) => (
          <span
            key={tick}
            className="absolute top-1/2 -translate-y-1/2 w-0.5 h-0.5 rounded-full bg-white/60 pointer-events-none"
            style={{ left: `${tick}%` }}
          />
        ))}
      </div>

      {/* Percentage label */}
      <div className="mt-1.5 flex justify-end">
        <span className={cn('text-xs font-semibold tabular-nums', labelClass)}>
          {used}/{total}%
        </span>
      </div>
    </div>
  )
}
