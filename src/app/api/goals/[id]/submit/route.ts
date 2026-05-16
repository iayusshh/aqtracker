import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/auth'
import { writeAuditLog } from '@/lib/audit'

type Params = { params: Promise<{ id: string }> }

/**
 * POST /api/goals/[id]/submit
 *
 * Submits a single draft goal OR all draft goals for the employee in the same
 * cycle (when id === "all"). Before submission, validates:
 *   - Total weightage of all goals in the cycle equals 100
 *   - At least one goal is in draft/returned status
 */
export async function POST(request: NextRequest, { params }: Params) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const supabase = await createClient()

  // Resolve the cycle for this goal
  const { data: targetGoal, error: fetchErr } = await supabase
    .from('goals')
    .select('*')
    .eq('id', id)
    .eq('employee_id', user.id)
    .single()

  if (fetchErr || !targetGoal) return NextResponse.json({ error: 'Goal not found' }, { status: 404 })

  if (targetGoal.status !== 'draft' && targetGoal.status !== 'returned') {
    return NextResponse.json({ error: `Goal is already "${targetGoal.status}"` }, { status: 409 })
  }

  // Fetch ALL goals in the same cycle to validate total weightage
  const { data: allGoals } = await supabase
    .from('goals')
    .select('id, weightage, status')
    .eq('employee_id', user.id)
    .eq('cycle_id', targetGoal.cycle_id)

  const totalWeightage = (allGoals ?? []).reduce((s, g) => s + g.weightage, 0)
  if (totalWeightage !== 100) {
    return NextResponse.json(
      { error: `Total weightage must equal 100% before submitting. Current total: ${totalWeightage}%` },
      { status: 400 }
    )
  }

  const { data: updated, error: updateErr } = await supabase
    .from('goals')
    .update({ status: 'submitted', updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 })

  await writeAuditLog(supabase, {
    tableName: 'goals',
    recordId: id,
    changedBy: user.id,
    changeType: 'update',
    oldValue: { status: targetGoal.status },
    newValue: { status: 'submitted' },
  })

  return NextResponse.json({ goal: updated })
}
