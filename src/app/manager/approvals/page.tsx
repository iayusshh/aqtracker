import { requireRole } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { CheckCircle, ChevronDown } from 'lucide-react'
import { StatusBadge } from '@/components/goals/StatusBadge'
import { UomBadge } from '@/components/goals/UomBadge'
import { getTargetDisplay } from '@/lib/goals'
import { ApprovalActions } from './ApprovalActions'
import type { UomType, GoalStatus } from '@/types'

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

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <CheckCircle className="w-6 h-6 text-green-600" />
            Goal Approvals
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Review and approve submitted goals from your direct reports
          </p>
        </div>

        {groups.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <CheckCircle className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="text-lg font-medium">No pending approvals</p>
            <p className="text-sm mt-1">All submitted goals have been processed</p>
          </div>
        ) : (
          <div className="space-y-8">
            {groups.map((group) => (
              <EmployeeApprovalGroup key={group.employee.id} group={group} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function EmployeeApprovalGroup({ group }: { group: EmployeeGoalGroup }) {
  const { employee, goals, totalWeightage } = group

  return (
    <section className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Employee header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50">
        <div>
          <h2 className="font-semibold text-gray-900">{employee.full_name}</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            {employee.email}
            {employee.department && ` • ${employee.department}`}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-500">
            {goals.length} goal{goals.length !== 1 ? 's' : ''} &bull; {totalWeightage}% total
          </span>
          <ApprovalActions type="approve-all" goalIds={goals.map((g) => g.id)} />
        </div>
      </div>

      {/* Goals list */}
      <ul className="divide-y divide-gray-100">
        {goals.map((goal) => (
          <GoalApprovalRow key={goal.id} goal={goal} />
        ))}
      </ul>
    </section>
  )
}

function GoalApprovalRow({ goal }: { goal: GoalRow }) {
  return (
    <li className="px-6 py-4">
      <details className="group">
        <summary className="flex items-center justify-between cursor-pointer list-none">
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <span className="text-xs font-medium text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-full px-2.5 py-0.5">
                {goal.thrust_area}
              </span>
              <UomBadge uomType={goal.uom_type} />
              <StatusBadge status={goal.status} />
            </div>
            <h3 className="font-medium text-gray-900 text-sm">{goal.title}</h3>
            <div className="flex items-center gap-4 mt-1 text-xs text-gray-500">
              <span>Target: {getTargetDisplay(goal.uom_type, goal.target)}</span>
              <span>Weightage: {goal.weightage}%</span>
            </div>
          </div>

          <div className="flex items-center gap-2 ml-4 shrink-0">
            <ApprovalActions type="return" goalId={goal.id} />
            <ApprovalActions type="approve" goalId={goal.id} currentWeightage={goal.weightage} />
            <ChevronDown className="w-4 h-4 text-gray-400 group-open:rotate-180 transition-transform" />
          </div>
        </summary>

        {/* Expanded details */}
        <div className="mt-4 pt-4 border-t border-gray-100">
          {goal.description ? (
            <p className="text-sm text-gray-600 mb-3">{goal.description}</p>
          ) : (
            <p className="text-sm text-gray-400 italic mb-3">No description provided</p>
          )}
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
            <div>
              <dt className="text-gray-500">UoM Type</dt>
              <dd className="font-medium text-gray-700 capitalize">{goal.uom_type.replace('_', ' ')}</dd>
            </div>
            <div>
              <dt className="text-gray-500">Target</dt>
              <dd className="font-medium text-gray-700">{getTargetDisplay(goal.uom_type, goal.target)}</dd>
            </div>
            <div>
              <dt className="text-gray-500">Weightage</dt>
              <dd className="font-medium text-gray-700">{goal.weightage}%</dd>
            </div>
            <div>
              <dt className="text-gray-500">Shared Goal</dt>
              <dd className="font-medium text-gray-700">{goal.is_shared ? 'Yes' : 'No'}</dd>
            </div>
          </dl>
        </div>
      </details>
    </li>
  )
}
