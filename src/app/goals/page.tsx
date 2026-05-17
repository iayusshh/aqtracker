export const revalidate = 30

import { redirect } from 'next/navigation'
import type { AppUser } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'

import Link from 'next/link'
import {
  Target,
  Plus,
  Share2,
  Lock,
  Edit2,
  AlertTriangle,
  ChevronRight,
  Gauge,
} from 'lucide-react'
import { StatusBadge } from '@/components/goals/StatusBadge'
import { UomBadge } from '@/components/goals/UomBadge'
import { WeightageBar } from '@/components/goals/WeightageBar'
import { getTargetDisplay, isEditable } from '@/lib/goals'
import { GoalActions } from './GoalActions'
import { ShimmerButton } from '@/components/ui/shimmer-button'
import { NumberTicker } from '@/components/ui/number-ticker'
import type { GoalStatus, UomType } from '@/types'
import { cn } from '@/lib/utils'

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

const STATUS_ACCENT: Record<GoalStatus, string> = {
  draft: 'bg-slate-300',
  submitted: 'bg-blue-400',
  approved: 'bg-emerald-400',
  returned: 'bg-red-400',
  locked: 'bg-violet-400',
}

export default async function GoalsPage() {
  const supabase = await createClient()

  // getUser() verifies the JWT — authoritative, not just cookie read
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) redirect('/login')

  // Parallel: user profile + active cycle (saves one sequential round-trip)
  const [profileRes, cycleRes] = await Promise.all([
    supabase.from('users').select('*').eq('id', authUser.id).single(),
    supabase
      .from('goal_cycles')
      .select('id, name, year, phase, status')
      .eq('status', 'active')
      .eq('phase', 'goal_setting')
      .limit(1)
      .maybeSingle(),
  ])

  const user = profileRes.data as AppUser | null
  if (!user) redirect('/login')

  const cycle = cycleRes.data
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

  // Batch-fetch return comments for all returned goals in a single query
  const returnReasons = new Map<string, string>()
  const returnedIds = goals.filter((g) => g.status === 'returned').map((g) => g.id)
  if (returnedIds.length > 0) {
    const { data: auditRows } = await supabase
      .from('audit_log')
      .select('record_id, new_value')
      .in('record_id', returnedIds)
      .eq('table_name', 'goals')
      .eq('change_type', 'update')
      .order('changed_at', { ascending: false })
    for (const row of auditRows ?? []) {
      if (!returnReasons.has(row.record_id)) {
        const nd = row.new_value as Record<string, unknown> | null
        if (nd && typeof nd['return_comment'] === 'string') {
          returnReasons.set(row.record_id, nd['return_comment'])
        }
      }
    }
  }

  const totalWeightage = goals.reduce((s, g) => s + g.weightage, 0)
  const goalCount = goals.length
  const isGoalSettingPhase = cycle?.phase === 'goal_setting'
  const canAddGoal = isGoalSettingPhase && goalCount < 8
  const hasSubmittableGoals = goals.some((g) => g.status === 'draft' || g.status === 'returned')
  const canSubmitAll = totalWeightage === 100 && hasSubmittableGoals
  const goalsRemaining = 8 - goalCount

  return (
    <div className="min-h-screen bg-slate-50/60">
      <div className="max-w-5xl mx-auto px-4 py-8 pt-10">

        {/* Breadcrumb */}
        <nav className="flex items-center gap-1.5 text-sm text-slate-400 mb-4">
          <Link href="/dashboard" className="hover:text-slate-600 transition-colors">Dashboard</Link>
          <ChevronRight className="w-3.5 h-3.5" />
          <span className="text-slate-500">My Goals</span>
        </nav>

        {/* Page Header */}
        <div className="flex items-start justify-between mb-7 gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-slate-900 to-slate-600 bg-clip-text text-transparent leading-tight">
              My Goals
            </h1>
            {cycle ? (
              <p className="mt-1.5 text-sm text-slate-400">
                {cycle.name} &bull; {cycle.year} &bull; Goal Setting Phase
              </p>
            ) : (
              <p className="mt-1.5 text-sm text-amber-600 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5" />
                No active goal-setting cycle. Check back later.
              </p>
            )}
          </div>

          {/* CTA buttons */}
          <div className="flex items-center gap-3 flex-wrap">
            {hasSubmittableGoals && (
              <div className="relative group">
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
              </div>
            )}

            {canAddGoal ? (
              <Link href={`/goals/new?cycle_id=${cycleId}`}>
                <ShimmerButton
                  background="rgba(79,70,229,1)"
                  borderRadius="8px"
                  className="gap-2 text-sm"
                  title={`${goalsRemaining} goal slot${goalsRemaining !== 1 ? 's' : ''} remaining`}
                >
                  <Plus className="w-4 h-4" />
                  Add Goal
                </ShimmerButton>
              </Link>
            ) : (
              <button
                disabled
                title={
                  goalCount >= 8
                    ? 'Maximum 8 goals reached'
                    : !isGoalSettingPhase
                    ? 'Goal setting window is not open'
                    : undefined
                }
                className="inline-flex items-center gap-2 rounded-lg bg-slate-200 px-4 py-2 text-sm font-medium text-slate-400 cursor-not-allowed"
              >
                <Plus className="w-4 h-4" />
                Add Goal
              </button>
            )}
          </div>
        </div>

        {/* Summary Banner */}
        {cycleId && (
          <div
            className={cn(
              'rounded-2xl border p-5 mb-7 transition-all duration-300',
              totalWeightage === 100
                ? 'bg-gradient-to-r from-emerald-50 to-teal-50 border-emerald-200'
                : 'bg-gradient-to-r from-indigo-50 to-violet-50 border-indigo-100'
            )}
          >
            <div className="flex items-center justify-between gap-4 mb-4 flex-wrap">
              {/* Goal count ticker */}
              <div className="flex items-center gap-3">
                <div className={cn(
                  'w-10 h-10 rounded-xl flex items-center justify-center',
                  totalWeightage === 100 ? 'bg-emerald-100' : 'bg-indigo-100'
                )}>
                  <Gauge className={cn('w-5 h-5', totalWeightage === 100 ? 'text-emerald-600' : 'text-indigo-600')} />
                </div>
                <div>
                  <p className="text-xs text-slate-500 uppercase tracking-wider font-medium mb-0.5">Goals Added</p>
                  <div className="text-2xl font-bold text-slate-900 flex items-baseline gap-1">
                    <NumberTicker value={goalCount} className="text-2xl font-bold text-slate-900" />
                    <span className="text-sm font-medium text-slate-400">/ 8</span>
                  </div>
                </div>
              </div>

              {/* Weightage donut + status pill */}
              <div className="flex items-center gap-4">
                {/* Simple conic-gradient donut */}
                <div className="flex items-center gap-2">
                  <div
                    className="w-12 h-12 rounded-full flex items-center justify-center text-[10px] font-bold text-slate-700"
                    style={{
                      background: `conic-gradient(${
                        totalWeightage === 100
                          ? '#10b981'
                          : totalWeightage > 100
                          ? '#ef4444'
                          : '#6366f1'
                      } ${totalWeightage * 3.6}deg, #e2e8f0 0deg)`,
                    }}
                  >
                    <span className="w-8 h-8 rounded-full bg-white flex items-center justify-center">
                      {totalWeightage}
                    </span>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 uppercase tracking-wider font-medium">Weightage</p>
                    <p className="text-sm font-semibold text-slate-700">{totalWeightage}% / 100%</p>
                  </div>
                </div>

                <span
                  className={cn(
                    'text-xs font-semibold px-3 py-1 rounded-full',
                    totalWeightage === 100
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-slate-100 text-slate-600'
                  )}
                >
                  {totalWeightage === 100 ? 'Ready to submit' : 'Incomplete'}
                </span>
              </div>
            </div>

            <WeightageBar used={totalWeightage} />
          </div>
        )}

        {/* Goal Cards */}
        {goals.length === 0 ? (
          /* Empty state */
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="relative mb-6">
              <div className="w-20 h-20 rounded-full bg-indigo-50 flex items-center justify-center shadow-[0_0_40px_rgba(99,102,241,0.15)]">
                <Target className="w-9 h-9 text-indigo-400" />
              </div>
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-indigo-100 rounded-full border-2 border-white" />
            </div>
            <h2 className="text-xl font-semibold text-slate-800 mb-2">No goals yet</h2>
            <p className="text-sm text-slate-400 max-w-xs mb-6">
              Set your performance goals for this cycle. You can add up to 8 goals with a total weightage of 100%.
            </p>
            {canAddGoal && (
              <Link href={`/goals/new?cycle_id=${cycleId}`}>
                <ShimmerButton background="rgba(79,70,229,1)" borderRadius="8px" className="gap-2 text-sm">
                  <Plus className="w-4 h-4" />
                  Add your first goal
                </ShimmerButton>
              </Link>
            )}
          </div>
        ) : (
          <ul className="space-y-4">
            {goals.map((goal) => (
              <GoalCard
                key={goal.id}
                goal={goal}
                canEdit={isGoalSettingPhase}
                returnReason={returnReasons.get(goal.id) ?? null}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

function GoalCard({ goal, canEdit, returnReason }: { goal: GoalRow; canEdit: boolean; returnReason: string | null }) {
  const editable = isEditable(goal.status) && canEdit

  return (
    <li className="group bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 cursor-pointer overflow-hidden">
      {/* Returned banner */}
      {goal.status === 'returned' && (
        <div className="bg-gradient-to-r from-red-50 to-amber-50 border-b border-red-100 px-5 py-2.5 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
          <div>
            <span className="text-xs font-semibold text-red-700 uppercase tracking-wider">Rework Required</span>
            {returnReason && (
              <p className="text-xs text-amber-700 mt-0.5">{returnReason}</p>
            )}
          </div>
        </div>
      )}

      <div className="flex">
        {/* Left accent bar */}
        <div className={cn('w-1 flex-shrink-0 rounded-l-2xl', STATUS_ACCENT[goal.status])} />

        <div className="flex-1 p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              {/* Top row: tags */}
              <div className="flex flex-wrap items-center gap-2 mb-2.5">
                {/* Thrust area pill */}
                <span className="inline-flex items-center rounded-full bg-indigo-50 border border-indigo-100 px-2.5 py-0.5 text-xs font-medium text-indigo-700">
                  {goal.thrust_area}
                </span>
                <UomBadge uomType={goal.uom_type} />
                <StatusBadge status={goal.status} />
                {goal.is_shared && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-teal-50 border border-teal-100 px-2 py-0.5 text-xs text-teal-700 font-medium">
                    <Share2 className="w-3 h-3" />
                    Shared
                  </span>
                )}
                {goal.status === 'locked' && (
                  <span className="inline-flex items-center gap-1 text-xs text-violet-600 font-medium">
                    <Lock className="w-3 h-3" />
                    Locked
                  </span>
                )}
              </div>

              {/* Title */}
              <h3 className="text-lg font-semibold text-slate-900 leading-snug truncate">
                {goal.title}
              </h3>

              {/* Description */}
              {goal.description && (
                <p className="mt-1 text-sm text-slate-500 line-clamp-2 leading-relaxed">
                  {goal.description}
                </p>
              )}

              {/* Bottom meta row */}
              <div className="mt-3 flex items-center gap-5 flex-wrap">
                {/* Target */}
                <div className="flex items-center gap-1.5 text-sm text-slate-600">
                  <Target className="w-3.5 h-3.5 text-slate-400" />
                  <span>Target:</span>
                  <strong className="text-slate-800">{getTargetDisplay(goal.uom_type, goal.target)}</strong>
                </div>

                {/* Weightage mini bar */}
                <div className="flex items-center gap-2">
                  <span className="text-sm text-slate-600">Weightage:</span>
                  <div className="flex items-center gap-1.5">
                    <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-indigo-400 to-indigo-600 rounded-full"
                        style={{ width: `${goal.weightage}%` }}
                      />
                    </div>
                    <strong className="text-sm text-slate-800">{goal.weightage}%</strong>
                  </div>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
              {editable && (
                <>
                  <Link
                    href={`/goals/${goal.id}/edit`}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-colors"
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
      </div>
    </li>
  )
}
