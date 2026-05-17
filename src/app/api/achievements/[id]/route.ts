import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireUser } from '@/lib/auth'
import { computeScore, computeTimelineScore } from '@/lib/utils'

function computeAchievementScore(
  uomType: string,
  target: string,
  actual: string
): number {
  if (uomType === 'timeline') {
    return computeTimelineScore(new Date(target), actual ? new Date(actual) : null)
  }
  const t = parseFloat(target)
  const a = parseFloat(actual)
  if (isNaN(t) || isNaN(a)) return 0
  return computeScore(uomType, t, a)
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const user = await requireUser()
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('quarterly_achievements')
    .select(`*, goals!inner(employee_id, uom_type, target, weightage)`)
    .eq('id', id)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 404 })
  if (data.goals.employee_id !== user.id && user.role === 'employee') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  return NextResponse.json(data)
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const user = await requireUser()
  const supabase = await createClient()

  const { data: existing, error: fetchErr } = await supabase
    .from('quarterly_achievements')
    .select(`*, goals!inner(employee_id, uom_type, target)`)
    .eq('id', id)
    .single()

  if (fetchErr || !existing) {
    return NextResponse.json({ error: 'Achievement not found' }, { status: 404 })
  }
  if (existing.goals.employee_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json()
  const actual_achievement = body.actual_achievement ?? existing.actual_achievement
  const status = body.status ?? existing.status

  const computed_score = computeAchievementScore(
    existing.goals.uom_type,
    existing.goals.target,
    actual_achievement
  )

  const oldValue = { ...existing }

  const { data, error } = await supabase
    .from('quarterly_achievements')
    .update({ actual_achievement, status, computed_score, submitted_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await supabase.from('audit_log').insert({
    table_name: 'quarterly_achievements',
    record_id: id,
    changed_by: user.id,
    change_type: 'update',
    old_value: oldValue,
    new_value: data,
    changed_at: new Date().toISOString(),
  })

  return NextResponse.json(data)
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const user = await requireUser()
  const supabase = await createClient()

  const { data: existing, error: fetchErr } = await supabase
    .from('quarterly_achievements')
    .select(`*, goals!inner(employee_id)`)
    .eq('id', id)
    .single()

  if (fetchErr || !existing) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  if (existing.goals.employee_id !== user.id && user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { error } = await supabase.from('quarterly_achievements').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
