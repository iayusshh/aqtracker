import { cn } from '@/lib/utils'
import type { GoalStatus } from '@/types'

interface StatusBadgeProps {
  status: GoalStatus
  className?: string
}

const STATUS_CONFIG: Record<
  GoalStatus,
  { label: string; containerClass: string; dotClass: string; pulse?: boolean }
> = {
  draft: {
    label: 'Draft',
    containerClass: 'bg-slate-100 text-slate-600',
    dotClass: 'bg-slate-400',
  },
  submitted: {
    label: 'Submitted',
    containerClass: 'bg-blue-50 text-blue-700',
    dotClass: 'bg-blue-400',
    pulse: true,
  },
  approved: {
    label: 'Approved',
    containerClass: 'bg-emerald-50 text-emerald-700',
    dotClass: 'bg-emerald-400',
  },
  returned: {
    label: 'Returned',
    containerClass: 'bg-red-50 text-red-700',
    dotClass: 'bg-red-400',
  },
  locked: {
    label: 'Locked',
    containerClass: 'bg-violet-50 text-violet-700',
    dotClass: 'bg-violet-400',
  },
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status]

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium',
        config.containerClass,
        className
      )}
    >
      <span
        className={cn(
          'w-1.5 h-1.5 rounded-full flex-shrink-0',
          config.dotClass,
          config.pulse && 'animate-pulse'
        )}
      />
      {config.label}
    </span>
  )
}
