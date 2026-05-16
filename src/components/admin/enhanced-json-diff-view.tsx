'use client'

import { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'

interface EnhancedJsonDiffViewProps {
  old_value: Record<string, unknown> | null
  new_value: Record<string, unknown> | null
}

// Simple syntax-highlighted JSON using spans
function highlightJson(json: string): string {
  return json
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(
      /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+-]?\d+)?)/g,
      (match) => {
        let cls = 'text-blue-600' // number
        if (/^"/.test(match)) {
          if (/:$/.test(match)) {
            cls = 'text-slate-500 font-medium' // key
          } else {
            cls = 'text-emerald-700' // string value
          }
        } else if (/true|false/.test(match)) {
          cls = 'text-violet-600' // boolean
        } else if (/null/.test(match)) {
          cls = 'text-slate-400' // null
        }
        return `<span class="${cls}">${match}</span>`
      }
    )
}

function JsonPane({
  label,
  value,
  side,
}: {
  label: string
  value: Record<string, unknown> | null
  side: 'old' | 'new'
}) {
  if (value === null) return null
  const json = JSON.stringify(value, null, 2)
  const highlighted = highlightJson(json)
  const headerClass = side === 'old'
    ? 'bg-red-50 border-red-100 text-red-600'
    : 'bg-emerald-50 border-emerald-100 text-emerald-600'
  const bodyClass = side === 'old'
    ? 'bg-red-50/40 border-red-100'
    : 'bg-emerald-50/40 border-emerald-100'

  return (
    <div className={`rounded-lg border overflow-hidden ${bodyClass}`}>
      <div className={`px-3 py-1.5 border-b text-[10px] font-semibold uppercase tracking-wider ${headerClass}`}>
        {label}
      </div>
      <pre
        className="px-3 py-2.5 text-xs font-mono max-h-48 overflow-auto whitespace-pre-wrap break-all leading-relaxed"
        dangerouslySetInnerHTML={{ __html: highlighted }}
      />
    </div>
  )
}

export function EnhancedJsonDiffView({ old_value, new_value }: EnhancedJsonDiffViewProps) {
  const [open, setOpen] = useState(false)

  const hasChanges = old_value !== null || new_value !== null
  if (!hasChanges) {
    return <span className="text-xs text-slate-300">—</span>
  }

  return (
    <div className="min-w-[180px]">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1 text-xs font-medium text-indigo-500 hover:text-indigo-700 transition-colors"
      >
        {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        {open ? 'Hide' : 'Show'} diff
      </button>

      {open && (
        <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2 min-w-[400px]">
          <JsonPane label="Before" value={old_value} side="old" />
          <JsonPane label="After" value={new_value} side="new" />
        </div>
      )}
    </div>
  )
}
