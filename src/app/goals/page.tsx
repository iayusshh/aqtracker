import { requireUser } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Target, Plus, Share2, Lock, Edit2 } from 'lucide-react'
import { StatusBadge } from '@/components/goals/StatusBadge'
import { UomBadge } from '@/components/goals/UomBadge'
import { WeightageBar } from '@/components/goals/WeightageBar'
import { getTargetDisplay, isEditable } from '@/lib/goals'
import { GoalActions } from './GoalActions'
import type { GoalStatus, UomType } from '@/types'

/** Shape returned by Supabase JS client (snake_case columns) */
interface GoalRow {
  id: string
  employee_id: string
  cycle_id: string
  thrust_area: string
  title: string
  description: string | null
  uom_type: UomType
  target: string
  weightage: number
  status: GoalStatus
  is_shared: boolean
  shared_from_goal_id: string | null
  created_at: string
  updated_at: string
}

export default async function GoalsPage() {
  const user = await requireUser()
  const supabase = await createClient()

  // Fetch the active goal_setting cycle
  const { data: cycle } = await supabase
    .from('goal_cycles')
    .select('id, name, year, phase, status')
    .eq('status', 'active')
    .eq('phase', 'goal_setting')
    .limit(1)
    .maybeSingle()

  const cycleId: string | null = cycle?.id ?? null

  let goals: GoalRow[] = []
  if (cycleId) {
    const { data } = await supabase
      .from('goals')
      .select('*')
      .eq('employee_id', user.id)
      .eq('cycle_id', cycleId)
      .order('created_at', { ascending: true })
    goals = (data ?? []) as GoalRow[]
  }

  const totalWeightage = goals.reduce((s, g) => s + g.weightage, 0)
  const goalCount = goals.length
  const isGoalSettingPhase = cycle?.phase === 'goal_setting'
  const canAddGoal = isGoalSettingPhase && goalCount < 8
  const hasSubmittableGoals = goals.some((g) => g.status === 'draft' || g.status === 'returned')
  const canSubmitAll = totalWeightage === 100 && hasSubmittableGoals

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Target className="w-6 h-6 text-blue-600" />
              My Goals
            </h1>
            {cycle ? (
              <p className="mt-1 text-sm text-gray-500">
                {cycle.name} &bull; {cycle.year} &bull; Goal Setting Phase
              </p>
            ) : (
              <p className="mt-1 text-sm text-amber-600">
                No active goal-setting cycle. Check back later.
              </p>
            )}
          </div>
          <div className="flex items-center gap-3">
            {hasSubmittableGoals && (
              <GoalActions
                type="submit-all"
                cycleId={cycleId ?? undefined}
                goals={goals.map((g) => ({ id: g.id, status: g.status, weightage: g.weightage }))}
                disabled={!canSubmitAll}
                disabledReason={
                  totalWeightage !== 100
                    ? `Total weightage is ${totalWeightage}% — must be 100% to submit`
                    : undefined
                }
              />
            )}
            <Link
              href={canAddGoal ? `/goals/new?cycle_id=${cycleId}` : '#'}
              aria-disabled={!canAddGoal}
              className={
                canAddGoal
                  ? 'inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors'
                  : 'inline-flex items-center gap-2 rounded-md bg-gray-300 px-4 py-2 text-sm font-medium text-gray-500 cursor-not-allowed'
              }
              title={
                goalCount >= 8
                  ? 'Maximum 8 goals reached'
                  : !isGoalSettingPhase
                  ? 'Goal setting window is not open'
                  : undefined
              }
            >
              <Plus className="w-4 h-4" />
              Add Goal
            </Link>
          </div>
        </div>

        {/* Summary Bar */}
        {cycleId && (
          <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-gray-700">
                {goalCount}/8 goals &bull; {totalWeightage}% allocated
              </span>
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                totalWeightage === 100
                  ? 'bg-green-100 text-green-700'
                  : 'bg-gray-100 text-gray-600'
              }`}>
                {totalWeightage === 100 ? 'Ready to submit' : 'Incomplete'}
              </span>
            </div>
            <WeightageBar used={totalWeightage} />
          </div>
        )}

        {/* Goal Cards */}
        {goals.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <Target className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="text-lg font-medium">No goals yet</p>
            {canAddGoal && (
              <p className="text-sm mt-1">
                <Link href={`/goals/new?cycle_id=${cycleId}`} className="text-blue-600 hover:underline">
                  Add your first goal
                </Link>
              </p>
            )}
          </div>
        ) : (
          <ul className="space-y-4">
            {goals.map((goal) => (
              <GoalCard key={goal.id} goal={goal} canEdit={isGoalSettingPhase} />
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

function GoalCard({ goal, canEdit }: { goal: GoalRow; canEdit: boolean }) {
  const editable = isEditable(goal.status) && canEdit

  return (
    <li className="bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
      <div className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            {/* Tags row */}
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className="inline-flex items-center rounded-full bg-indigo-50 border border-indigo-200 px-2.5 py-0.5 text-xs font-medium text-indigo-700">
                {goal.thrust_area}
              </span>
              <UomBadge uomType={goal.uom_type} />
              <StatusBadge status={goal.status} />
              {goal.is_shared && (
                <span className="inline-flex items-center gap-1 rounded-full bg-teal-50 border border-teal-200 px-2 py-0.5 text-xs text-teal-700">
                  <Share2 className="w-3 h-3" />
                  Shared
                </span>
              )}
              {goal.status === 'locked' && (
                <span className="inline-flex items-center gap-1 text-xs text-purple-600">
                  <Lock className="w-3 h-3" />
                  Locked
                </span>
              )}
            </div>

            {/* Title */}
            <h3 className="text-base font-semibold text-gray-900 truncate">{goal.title}</h3>

            {goal.description && (
              <p className="mt-1 text-sm text-gray-500 line-clamp-2">{goal.description}</p>
            )}

            {/* Meta */}
            <div className="mt-3 flex items-center gap-4 text-sm text-gray-600">
              <span>Target: <strong>{getTargetDisplay(goal.uom_type, goal.target)}</strong></span>
              <span>Weightage: <strong>{goal.weightage}%</strong></span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 shrink-0">
            {editable && (
              <>
                <Link
                  href={`/goals/${goal.id}/edit`}
                  className="inline-flex items-center gap-1 rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  Edit
                </Link>
                {goal.status === 'draft' && (
                  <GoalActions type="delete" goalId={goal.id} />
                )}
                {(goal.status === 'draft' || goal.status === 'returned') && (
                  <GoalActions type="submit" goalId={goal.id} cycleId={goal.cycle_id} />
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </li>
  )
}
