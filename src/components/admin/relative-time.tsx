'use client'

import { useMemo } from 'react'

interface RelativeTimeProps {
  timestamp: string
}

function getRelativeTime(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffSecs = Math.floor(diffMs / 1000)
  const diffMins = Math.floor(diffSecs / 60)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffSecs < 60) return 'just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`
  if (diffDays < 30) return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function RelativeTime({ timestamp }: RelativeTimeProps) {
  const relative = useMemo(() => getRelativeTime(timestamp), [timestamp])
  const date = new Date(timestamp)
  const fullDatetime = date.toLocaleString('en-IN', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })

  return (
    <div title={fullDatetime} className="cursor-default group">
      <span className="text-sm text-slate-700 font-medium group-hover:text-indigo-600 transition-colors">
        {relative}
      </span>
      <span className="block text-xs text-slate-400 mt-0.5">
        {date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
      </span>
    </div>
  )
}
