import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/auth'
import { writeAuditLog } from '@/lib/audit'
import { validateGoalForm, isEditable } from '@/lib/goals'
import type { GoalFormData } from '@/lib/goals'

type Params = { params: Promise<{ id: string }> }

/** GET /api/goals/[id] */
export async function GET(_req: NextRequest, { params }: Params) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const supabase = await createClient()

  const { data: goal, error } = await supabase
    .from('goals')
    .select('*, cycle:goal_cycles(id,name,year,phase,status), employee:users(id,full_name,email,role,department)')
    .eq('id', id)
    .single()

  if (error || !goal) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Employees can only see their own goals
  if (user.role === 'employee' && goal.employee_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  // Managers can see goals of their direct reports
  if (user.role === 'manager' && goal.employee?.manager_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  return NextResponse.json({ goal })
}

/** PATCH /api/goals/[id] */
export async function PATCH(request: NextRequest, { params }: Params) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const supabase = await createClient()

  const { data: existing, error: fetchErr } = await supabase
    .from('goals')
    .select('*')
    .eq('id', id)
    .single()

  if (fetchErr || !existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (existing.employee_id !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  if (!isEditable(existing.status)) {
    return NextResponse.json({ error: `Cannot edit a goal with status "${existing.status}"` }, { status: 409 })
  }

  const body: Partial<GoalFormData> = await request.json()

  // Shared goals: only weightage can be changed
  if (existing.is_shared) {
    if (body.title || body.thrustArea || body.uomType || body.target || body.description) {
      return NextResponse.json({ error: 'Shared goals: only weightage can be edited' }, { status: 400 })
    }
  }

  // Fetch other goals for weightage validation
  const { data: otherGoals } = await supabase
    .from('goals')
    .select('id, weightage')
    .eq('employee_id', user.id)
    .eq('cycle_id', existing.cycle_id)
    .neq('id', id)

  const usedByOthers = (otherGoals ?? []).reduce((s, g) => s + g.weightage, 0)

  const merged: GoalFormData = {
    thrustArea: body.thrustArea ?? existing.thrust_area,
    title: body.title ?? existing.title,
    description: body.description ?? existing.description ?? '',
    uomType: body.uomType ?? existing.uom_type,
    target: body.target ?? existing.target,
    weightage: body.weightage ?? existing.weightage,
  }

  const validation = validateGoalForm(merged, usedByOthers, existing.weightage)
  if (!validation.valid) {
    return NextResponse.json({ error: 'Validation failed', errors: validation.errors }, { status: 422 })
  }

  const updates: Record<string, unknown> = {
    thrust_area: merged.thrustArea,
    title: merged.title,
    description: merged.description || null,
    uom_type: merged.uomType,
    target: merged.uomType === 'zero' ? 'N/A' : merged.target,
    weightage: merged.weightage,
    updated_at: new Date().toISOString(),
  }

  // If the goal was returned, move it back to draft on edit
  if (existing.status === 'returned') updates.status = 'draft'

  const { data: updated, error: updateErr } = await supabase
    .from('goals')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 })

  await writeAuditLog(supabase, {
    tableName: 'goals',
    recordId: id,
    changedBy: user.id,
    changeType: 'update',
    oldValue: existing,
    newValue: updated,
  })

  return NextResponse.json({ goal: updated })
}

/** DELETE /api/goals/[id] — only draft goals */
export async function DELETE(_req: NextRequest, { params }: Params) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const supabase = await createClient()

  const { data: existing, error: fetchErr } = await supabase
    .from('goals')
    .select('*')
    .eq('id', id)
    .single()

  if (fetchErr || !existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (existing.employee_id !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  if (existing.status !== 'draft') {
    return NextResponse.json({ error: 'Only draft goals can be deleted' }, { status: 409 })
  }

  const { error: delErr } = await supabase.from('goals').delete().eq('id', id)
  if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 })

  await writeAuditLog(supabase, {
    tableName: 'goals',
    recordId: id,
    changedBy: user.id,
    changeType: 'delete',
    oldValue: existing,
  })

  return NextResponse.json({ success: true })
}
