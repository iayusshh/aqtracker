import { requireUser } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft, Share2 } from 'lucide-react'
import { GoalForm } from '@/components/goals/GoalForm'
import { isEditable } from '@/lib/goals'
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
  shared_from_goal_id: string | null
}

interface EditGoalPageProps {
  params: Promise<{ id: string }>
}

export default async function EditGoalPage({ params }: EditGoalPageProps) {
  const user = await requireUser()
  const { id } = await params
  const supabase = await createClient()

  const { data: goalRaw, error } = await supabase
    .from('goals')
    .select('*, cycle:goal_cycles(id,name,year,phase,status)')
    .eq('id', id)
    .eq('employee_id', user.id)
    .single()

  if (error || !goalRaw) notFound()

  const goal = goalRaw as GoalRow & {
    cycle: { id: string; name: string; year: number; phase: string; status: string }
  }

  if (!isEditable(goal.status)) redirect('/goals')
  if (goal.cycle.phase !== 'goal_setting' || goal.cycle.status !== 'active') redirect('/goals')

  // Compute used weightage excluding this goal
  const { data: otherGoals } = await supabase
    .from('goals')
    .select('id, weightage')
    .eq('employee_id', user.id)
    .eq('cycle_id', goal.cycle_id)
    .neq('id', id)

  const usedByOthers = (otherGoals ?? []).reduce((s, g) => s + g.weightage, 0)

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="mb-6">
          <Link
            href="/goals"
            className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4"
          >
            <ChevronLeft className="w-4 h-4" />
            Back to Goals
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">Edit Goal</h1>
            {goal.is_shared && (
              <span className="inline-flex items-center gap-1 rounded-full bg-teal-50 border border-teal-200 px-2.5 py-0.5 text-xs text-teal-700">
                <Share2 className="w-3 h-3" />
                Shared Goal
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-gray-500">
            {goal.cycle.name} &bull; {goal.cycle.year}
          </p>
          {goal.status === 'returned' && (
            <p className="mt-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
              This goal was returned by your manager. Please review and resubmit.
            </p>
          )}
        </div>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <GoalForm
            goal={goal}
            cycleId={goal.cycle_id}
            usedWeightage={usedByOthers}
            currentGoalWeightage={goal.weightage}
            isShared={goal.is_shared}
          />
        </div>
      </div>
    </div>
  )
}
