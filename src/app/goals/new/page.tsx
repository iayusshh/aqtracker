import { requireUser } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { GoalForm } from '@/components/goals/GoalForm'

interface NewGoalPageProps {
  searchParams: Promise<{ cycle_id?: string }>
}

export default async function NewGoalPage({ searchParams }: NewGoalPageProps) {
  const user = await requireUser()
  const { cycle_id } = await searchParams
  const supabase = await createClient()

  // Resolve the cycle — prefer query param, fall back to active goal_setting cycle
  let cycleId = cycle_id
  if (!cycleId) {
    const { data: cycle } = await supabase
      .from('goal_cycles')
      .select('id')
      .eq('status', 'active')
      .eq('phase', 'goal_setting')
      .limit(1)
      .maybeSingle()
    if (cycle) cycleId = cycle.id
  }

  if (!cycleId) {
    redirect('/goals')
  }

  // Verify the cycle is in goal_setting phase
  const { data: cycle } = await supabase
    .from('goal_cycles')
    .select('id, name, year, phase, status')
    .eq('id', cycleId)
    .single()

  if (!cycle || cycle.phase !== 'goal_setting' || cycle.status !== 'active') {
    redirect('/goals')
  }

  // Compute used weightage for the current employee in this cycle
  const { data: existingGoals } = await supabase
    .from('goals')
    .select('id, weightage')
    .eq('employee_id', user.id)
    .eq('cycle_id', cycleId)

  if ((existingGoals ?? []).length >= 8) {
    redirect('/goals')
  }

  const usedWeightage = (existingGoals ?? []).reduce((s, g) => s + g.weightage, 0)

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
          <h1 className="text-2xl font-bold text-gray-900">Add New Goal</h1>
          <p className="mt-1 text-sm text-gray-500">
            {cycle.name} &bull; {cycle.year} &bull; {100 - usedWeightage}% weightage remaining
          </p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <GoalForm
            cycleId={cycleId}
            usedWeightage={usedWeightage}
          />
        </div>
      </div>
    </div>
  )
}
