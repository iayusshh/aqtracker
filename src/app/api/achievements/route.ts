import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireUser } from '@/lib/auth'
import { computeScore, computeTimelineScore, getQuarterWindow } from '@/lib/utils'

function isWindowOpen(quarter: string): boolean {
  const now = new Date()
  const window = getQuarterWindow(quarter)
  return now >= window.open && now <= window.close
}

function computeAchievementScore(
  uomType: string,
  target: string,
  actual: string
): number {
  if (uomType === 'timeline') {
    const targetDate = new Date(target)
    const completionDate = actual ? new Date(actual) : null
    return computeTimelineScore(targetDate, completionDate)
  }
  const targetNum = parseFloat(target)
  const actualNum = parseFloat(actual)
  if (isNaN(targetNum) || isNaN(actualNum)) return 0
  return computeScore(uomType, targetNum, actualNum)
}

export async function GET(req: NextRequest) {
  const user = await requireUser()
  const supabase = await createClient()
  const { searchParams } = new URL(req.url)
  const quarter = searchParams.get('quarter')

  let query = supabase
    .from('quarterly_achievements')
    .select(`
      *,
      goals!inner (
        id, title, uom_type, target, weightage, status, employee_id
      )
    `)
    .eq('goals.employee_id', user.id)

  if (quarter) query = query.eq('quarter', quarter)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const user = await requireUser()
  const supabase = await createClient()

  const body = await req.json()
  const { goal_id, quarter, actual_achievement, status } = body

  if (!goal_id || !quarter || status === undefined) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  if (!isWindowOpen(quarter)) {
    return NextResponse.json(
      { error: `Check-in window for ${quarter} is not currently open` },
      { status: 403 }
    )
  }

  const { data: goal, error: goalError } = await supabase
    .from('goals')
    .select('id, employee_id, uom_type, target, weightage, status, is_shared, shared_from_goal_id')
    .eq('id', goal_id)
    .single()

  if (goalError || !goal) {
    return NextResponse.json({ error: 'Goal not found' }, { status: 404 })
  }
  if (goal.employee_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  if (goal.status !== 'approved' && goal.status !== 'locked') {
    return NextResponse.json(
      { error: 'Only approved/locked goals can be checked in' },
      { status: 400 }
    )
  }

  const computed_score = computeAchievementScore(
    goal.uom_type,
    goal.target,
    actual_achievement ?? '0'
  )

  const { data, error } = await supabase
    .from('quarterly_achievements')
    .upsert(
      {
        goal_id,
        quarter,
        actual_achievement: actual_achievement ?? '',
        status,
        computed_score,
        submitted_at: new Date().toISOString(),
      },
      { onConflict: 'goal_id,quarter' }
    )
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await supabase.from('audit_log').insert({
    table_name: 'quarterly_achievements',
    record_id: data.id,
    changed_by: user.id,
    change_type: 'update',
    new_value: data,
    old_value: null,
    changed_at: new Date().toISOString(),
  })

  // Sync achievement to all linked shared goals (BRD §10)
  // Only when this goal is the shared source (is_shared=true, shared_from_goal_id=null)
  if (goal.is_shared && !goal.shared_from_goal_id) {
    const { data: linkedGoals } = await supabase
      .from('goals')
      .select('id')
      .eq('shared_from_goal_id', goal.id)
      .in('status', ['approved', 'locked'])

    if (linkedGoals?.length) {
      await supabase.from('quarterly_achievements').upsert(
        linkedGoals.map((lg) => ({
          goal_id: lg.id,
          quarter,
          actual_achievement: actual_achievement ?? '',
          status,
          computed_score,
          submitted_at: new Date().toISOString(),
        })),
        { onConflict: 'goal_id,quarter' }
      )
    }
  }

  return NextResponse.json(data, { status: 201 })
}
