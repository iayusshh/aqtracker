import { cn } from '@/lib/utils'
import { STATUS_META } from '@/lib/goals'
import type { GoalStatus } from '@/types'

interface StatusBadgeProps {
  status: GoalStatus
  className?: string
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const meta = STATUS_META[status]
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
        meta.color,
        className
      )}
    >
      {meta.label}
    </span>
  )
}
