import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/auth'
import { writeAuditLog } from '@/lib/audit'
import type { UomType } from '@/types'

interface SharedGoalPayload {
  cycleId: string
  thrustArea: string
  title: string
  description?: string
  uomType: UomType
  target: string
  defaultWeightage: number
  employeeIds: string[]
}

/**
 * POST /api/admin/shared-goals
 * Admin only. Pushes a shared goal to multiple employees.
 * Creates one goal record per employee with is_shared=true.
 */
export async function POST(request: NextRequest) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden: admin role required' }, { status: 403 })
  }

  const body: SharedGoalPayload = await request.json()

  if (!body.employeeIds?.length) {
    return NextResponse.json({ error: 'At least one employee must be selected' }, { status: 400 })
  }
  if (!body.title?.trim()) return NextResponse.json({ error: 'Title is required' }, { status: 400 })
  if (!body.thrustArea?.trim()) return NextResponse.json({ error: 'Thrust area is required' }, { status: 400 })
  if (!body.uomType) return NextResponse.json({ error: 'UoM type is required' }, { status: 400 })
  if (!body.defaultWeightage || body.defaultWeightage < 10) {
    return NextResponse.json({ error: 'Default weightage must be at least 10%' }, { status: 400 })
  }

  const supabase = await createClient()

  // Verify cycle exists and is in goal_setting phase
  const { data: cycle, error: cycleErr } = await supabase
    .from('goal_cycles')
    .select('id, phase, status')
    .eq('id', body.cycleId)
    .single()

  if (cycleErr || !cycle) return NextResponse.json({ error: 'Cycle not found' }, { status: 404 })
  if (cycle.phase !== 'goal_setting' || cycle.status !== 'active') {
    return NextResponse.json({ error: 'Shared goals can only be pushed during an active goal_setting cycle' }, { status: 400 })
  }

  const target = body.uomType === 'zero' ? 'N/A' : body.target

  // Build insert rows for all selected employees
  const rows = body.employeeIds.map((empId) => ({
    employee_id: empId,
    cycle_id: body.cycleId,
    thrust_area: body.thrustArea,
    title: body.title,
    description: body.description || null,
    uom_type: body.uomType,
    target,
    weightage: body.defaultWeightage,
    status: 'draft' as const,
    is_shared: true,
  }))

  const { data: created, error: insertErr } = await supabase
    .from('goals')
    .insert(rows)
    .select()

  if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 })

  // Audit each created goal
  await Promise.all(
    (created ?? []).map((g) =>
      writeAuditLog(supabase, {
        tableName: 'goals',
        recordId: g.id,
        changedBy: user.id,
        changeType: 'insert',
        newValue: g,
      })
    )
  )

  // Second pass: link shared_from_goal_id to the first goal in the batch
  if (created && created.length > 1) {
    const sourceId = created[0].id
    const linkedIds = created.slice(1).map((g) => g.id)
    await supabase
      .from('goals')
      .update({ shared_from_goal_id: sourceId })
      .in('id', linkedIds)
  }

  return NextResponse.json({ created: created?.length ?? 0, goals: created }, { status: 201 })
}
