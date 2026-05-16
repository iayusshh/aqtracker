import { cn } from '@/lib/utils'
import { UOM_LABELS } from '@/lib/goals'
import type { UomType } from '@/types'

interface UomBadgeProps {
  uomType: UomType
  className?: string
}

export function UomBadge({ uomType, className }: UomBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded px-1.5 py-0.5 text-xs font-mono bg-amber-50 text-amber-700 border border-amber-200',
        className
      )}
    >
      {UOM_LABELS[uomType]}
    </span>
  )
}
