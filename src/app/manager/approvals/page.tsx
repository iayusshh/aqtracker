import { requireRole } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { getTargetDisplay } from '@/lib/goals'
import { ApprovalActions } from './ApprovalActions'
import { ShimmerButton } from '@/components/ui/shimmer-button'
import { UomBadge } from '@/components/goals/UomBadge'
import type { UomType, GoalStatus } from '@/types'
import { CheckCircle2, ChevronRight } from 'lucide-react'

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
}

interface EmployeeRow {
  id: string
  full_name: string
  email: string
  department: string | null
}

interface EmployeeGoalGroup {
  employee: EmployeeRow
  goals: GoalRow[]
  totalWeightage: number
}

export default async function ApprovalsPage() {
  const manager = await requireRole(['manager', 'admin'])
  const supabase = await createClient()

  // Fetch all direct reports
  const { data: directReports } = await supabase
    .from('users')
    .select('id, full_name, email, department')
    .eq('manager_id', manager.id)
    .eq('is_active', true)

  const reportIds = (directReports ?? []).map((u) => u.id)

  let groups: EmployeeGoalGroup[] = []

  if (reportIds.length > 0) {
    const { data: goals } = await supabase
      .from('goals')
      .select('*')
      .in('employee_id', reportIds)
      .eq('status', 'submitted')
      .order('created_at', { ascending: true })

    const goalsByEmployee = new Map<string, GoalRow[]>()
    for (const g of (goals ?? []) as GoalRow[]) {
      const list = goalsByEmployee.get(g.employee_id) ?? []
      list.push(g)
      goalsByEmployee.set(g.employee_id, list)
    }

    groups = (directReports as EmployeeRow[])
      .filter((r) => goalsByEmployee.has(r.id))
      .map((r) => {
        const empGoals = goalsByEmployee.get(r.id) ?? []
        return {
          employee: r,
          goals: empGoals,
          totalWeightage: empGoals.reduce((s, g) => s + g.weightage, 0),
        }
      })
  }

  const totalPending = groups.reduce((sum, g) => sum + g.goals.length, 0)

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/30">
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Page header */}
        <div className="mb-8">
          <div className="flex items-center gap-2 text-sm text-slate-400 mb-2">
            <span>Manager</span>
            <ChevronRight className="w-3.5 h-3.5" />
            <span className="text-slate-600 font-medium">Approvals</span>
          </div>
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-bold bg-gradient-to-r from-indigo-600 via-violet-600 to-purple-600 bg-clip-text text-transparent">
              Goal Approvals
            </h1>
            {totalPending > 0 && (
              <span className="inline-flex items-center rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700 ring-1 ring-amber-200">
                {totalPending} pending
              </span>
            )}
          </div>
          <p className="mt-1.5 text-sm text-slate-500">
            Review and approve submitted goals from your direct reports
          </p>
        </div>

        {groups.length === 0 ? (
          /* Empty state */
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="relative mb-6">
              <div className="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center">
                <CheckCircle2 className="w-10 h-10 text-emerald-500" />
              </div>
            </div>
            <h2 className="text-xl font-semibold text-slate-800 mb-2">All caught up!</h2>
            <p className="text-slate-500 max-w-xs">
              No goals pending approval. All submitted goals from your team have been processed.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {groups.map((group) => (
              <EmployeeApprovalGroup key={group.employee.id} group={group} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function getInitials(name: string) {
  return name
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

function EmployeeApprovalGroup({ group }: { group: EmployeeGoalGroup }) {
  const { employee, goals, totalWeightage } = group

  return (
    <section className="bg-white rounded-2xl border border-slate-200/80 shadow-sm shadow-slate-100 overflow-hidden">
      {/* Employee header */}
      <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 bg-slate-50/60">
        <div className="flex items-center gap-4">
          {/* Avatar initials */}
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white text-sm font-bold shrink-0 shadow-sm">
            {getInitials(employee.full_name)}
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h2 className="font-semibold text-slate-900">{employee.full_name}</h2>
              {employee.department && (
                <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 ring-1 ring-slate-200">
                  {employee.department}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 mt-0.5">{employee.email}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="inline-flex items-center rounded-full bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700 ring-1 ring-amber-200">
            {goals.length} goal{goals.length !== 1 ? 's' : ''} pending
          </span>
          <span className="text-xs text-slate-400 hidden sm:block">
            {totalWeightage}% total weightage
          </span>
          <ApprovalActions type="approve-all" goalIds={goals.map((g) => g.id)} />
        </div>
      </div>

      {/* Goals list */}
      <ul className="divide-y divide-slate-100">
        {goals.map((goal) => (
          <GoalApprovalRow key={goal.id} goal={goal} />
        ))}
      </ul>
    </section>
  )
}

function GoalApprovalRow({ goal }: { goal: GoalRow }) {
  return (
    <li className="px-6 py-4 hover:bg-slate-50 transition-all duration-150 group">
      <details className="group/details">
        <summary className="flex items-start justify-between cursor-pointer list-none gap-4">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            {/* Status dot — pulsing blue for submitted */}
            <div className="mt-1.5 shrink-0">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-blue-500" />
              </span>
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
                {/* Thrust area pill */}
                <span className="inline-flex items-center rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-medium text-indigo-700 ring-1 ring-indigo-200">
                  {goal.thrust_area}
                </span>
                <UomBadge uomType={goal.uom_type} />
              </div>
              <h3 className="font-medium text-slate-800 text-sm leading-snug">{goal.title}</h3>
              <div className="flex items-center gap-3 mt-1.5">
                <span className="font-mono text-xs text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                  Target: {getTargetDisplay(goal.uom_type, goal.target)}
                </span>
                <span className="inline-flex items-center rounded-full bg-violet-50 px-2 py-0.5 text-xs font-medium text-violet-700">
                  {goal.weightage}% wt.
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <ApprovalActions type="return" goalId={goal.id} />
            <ApprovalActions type="approve" goalId={goal.id} currentWeightage={goal.weightage} />
          </div>
        </summary>

        {/* Expanded details */}
        <div className="mt-4 ml-5 pt-4 border-t border-slate-100">
          {goal.description ? (
            <p className="text-sm text-slate-600 mb-4 leading-relaxed">{goal.description}</p>
          ) : (
            <p className="text-sm text-slate-400 italic mb-4">No description provided</p>
          )}
          <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'UoM Type', value: goal.uom_type.replace('_', ' ') },
              { label: 'Target', value: getTargetDisplay(goal.uom_type, goal.target) },
              { label: 'Weightage', value: `${goal.weightage}%` },
              { label: 'Shared Goal', value: goal.is_shared ? 'Yes' : 'No' },
            ].map(({ label, value }) => (
              <div key={label} className="rounded-lg bg-slate-50 px-3 py-2.5">
                <dt className="text-[10px] uppercase tracking-wide text-slate-400 font-medium mb-0.5">{label}</dt>
                <dd className="text-sm font-medium text-slate-700 capitalize">{value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </details>
    </li>
  )
}
