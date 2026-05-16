'use client'

import { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

interface JsonDiffViewProps {
  old_value: Record<string, unknown> | null
  new_value: Record<string, unknown> | null
}

function DiffEntry({
  label,
  value,
  color,
}: {
  label: string
  value: unknown
  color: string
}) {
  return (
    <div className={cn('rounded p-2 font-mono text-xs', color)}>
      <span className="font-semibold">{label}:</span>
      <pre className="mt-1 max-h-32 overflow-auto whitespace-pre-wrap break-all">
        {JSON.stringify(value, null, 2)}
      </pre>
    </div>
  )
}

export function JsonDiffView({ old_value, new_value }: JsonDiffViewProps) {
  const [open, setOpen] = useState(false)

  const hasChanges = old_value !== null || new_value !== null

  if (!hasChanges) {
    return <span className="text-xs text-gray-400">—</span>
  }

  return (
    <div className="min-w-[200px] max-w-sm">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-800 transition-colors"
      >
        {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        {open ? 'Hide' : 'Show'} diff
      </button>

      {open && (
        <div className="mt-2 space-y-2">
          {old_value !== null && (
            <DiffEntry label="Old" value={old_value} color="bg-red-50 text-red-700" />
          )}
          {new_value !== null && (
            <DiffEntry label="New" value={new_value} color="bg-emerald-50 text-emerald-700" />
          )}
        </div>
      )}
    </div>
  )
}
