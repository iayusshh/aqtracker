import { cn } from '@/lib/utils'

interface WeightageBarProps {
  used: number
  total?: number
}

export function WeightageBar({ used, total = 100 }: WeightageBarProps) {
  const pct = Math.min((used / total) * 100, 100)
  const isComplete = used === total
  const isOver = used > total

  return (
    <div className="w-full">
      <div className="flex justify-between text-sm mb-1">
        <span className={cn('font-medium', isOver ? 'text-red-600' : isComplete ? 'text-green-600' : 'text-gray-700')}>
          {used}% allocated
        </span>
        <span className="text-gray-500">{isComplete ? 'Ready to submit' : `${total - used}% remaining`}</span>
      </div>
      <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
        <div
          className={cn(
            'h-full rounded-full transition-all duration-300',
            isOver ? 'bg-red-500' : isComplete ? 'bg-green-500' : 'bg-blue-500'
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}
