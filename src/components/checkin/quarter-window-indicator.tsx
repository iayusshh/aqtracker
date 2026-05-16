'use client'

import { Calendar } from 'lucide-react'
import { cn, formatDate, getQuarterWindow } from '@/lib/utils'

interface QuarterWindowIndicatorProps {
  quarter: string
  className?: string
}

const QUARTER_LABELS: Record<string, string> = {
  goal_setting: 'Goal Setting',
  q1: 'Q1 Check-in',
  q2: 'Q2 Check-in',
  q3: 'Q3 Check-in',
  q4_annual: 'Q4 / Annual Review',
}

export function QuarterWindowIndicator({ quarter, className }: QuarterWindowIndicatorProps) {
  const now = new Date()
  const window = getQuarterWindow(quarter)
  const isOpen = now >= window.open && now <= window.close
  const isPast = now > window.close
  const label = QUARTER_LABELS[quarter] ?? quarter

  return (
    <div
      className={cn(
        'flex items-center gap-3 rounded-lg border px-4 py-3',
        isOpen
          ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
          : isPast
          ? 'border-gray-200 bg-gray-50 text-gray-500'
          : 'border-amber-200 bg-amber-50 text-amber-800',
        className
      )}
    >
      <Calendar size={16} className="shrink-0" />
      <div className="flex flex-col gap-0.5">
        <span className="text-sm font-medium">{label}</span>
        <span className="text-xs">
          {formatDate(window.open)} – {formatDate(window.close)}
          {isOpen && (
            <span className="ml-2 inline-flex items-center gap-1">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Window open
            </span>
          )}
          {isPast && ' (Closed)'}
          {!isOpen && !isPast && ' (Not yet open)'}
        </span>
      </div>
    </div>
  )
}
