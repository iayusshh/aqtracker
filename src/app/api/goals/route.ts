import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/auth'
import { writeAuditLog } from '@/lib/audit'
import { validateGoalForm } from '@/lib/goals'
import type { GoalFormData } from '@/lib/goals'

/** GET /api/goals — list goals for the authenticated employee in the active cycle */
export async function GET(request: NextRequest) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = await createClient()
  const { searchParams } = new URL(request.url)
  const cycleId = searchParams.get('cycle_id')

  let query = supabase
    .from('goals')
    .select('*, cycle:goal_cycles(id,name,year,phase,status)')
    .eq('employee_id', user.id)
    .order('created_at', { ascending: true })

  if (cycleId) {
    query = query.eq('cycle_id', cycleId)
  } else {
    // Default: active cycle in goal_setting phase
    const { data: cycle } = await supabase
      .from('goal_cycles')
      .select('id')
      .eq('status', 'active')
      .eq('phase', 'goal_setting')
      .limit(1)
      .maybeSingle()

    if (cycle) query = query.eq('cycle_id', cycle.id)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ goals: data ?? [] })
}

/** POST /api/goals — create a new goal */
export async function POST(request: NextRequest) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body: GoalFormData & { cycle_id: string } = await request.json()
  const supabase = await createClient()

  // Fetch existing goals for weightage check
  const { data: existingGoals } = await supabase
    .from('goals')
    .select('id, weightage')
    .eq('employee_id', user.id)
    .eq('cycle_id', body.cycle_id)

  const usedWeightage = (existingGoals ?? []).reduce((s, g) => s + g.weightage, 0)

  if ((existingGoals ?? []).length >= 8) {
    return NextResponse.json({ error: 'Maximum 8 goals per cycle reached' }, { status: 400 })
  }

  const validation = validateGoalForm(body, usedWeightage)
  if (!validation.valid) {
    return NextResponse.json({ error: 'Validation failed', errors: validation.errors }, { status: 422 })
  }

  // Verify cycle is in goal_setting phase
  const { data: cycle } = await supabase
    .from('goal_cycles')
    .select('phase, status')
    .eq('id', body.cycle_id)
    .single()

  if (!cycle || cycle.phase !== 'goal_setting' || cycle.status !== 'active') {
    return NextResponse.json({ error: 'Goal creation is only allowed during the goal_setting phase' }, { status: 403 })
  }

  const { data: goal, error } = await supabase
    .from('goals')
    .insert({
      employee_id: user.id,
      cycle_id: body.cycle_id,
      thrust_area: body.thrustArea,
      title: body.title,
      description: body.description || null,
      uom_type: body.uomType,
      target: body.uomType === 'zero' ? 'N/A' : body.target,
      weightage: body.weightage,
      status: 'draft',
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await writeAuditLog(supabase, {
    tableName: 'goals',
    recordId: goal.id,
    changedBy: user.id,
    changeType: 'insert',
    newValue: goal,
  })

  return NextResponse.json({ goal }, { status: 201 })
}
