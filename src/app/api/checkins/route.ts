import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const user = await requireRole(['manager', 'admin'])
  const supabase = await createClient()
  const { searchParams } = new URL(req.url)
  const goal_id = searchParams.get('goal_id')
  const quarter = searchParams.get('quarter')

  let query = supabase
    .from('checkin_comments')
    .select(`*, manager:users!manager_id(id, full_name)`)
    .order('created_at', { ascending: false })

  if (user.role === 'manager') query = query.eq('manager_id', user.id)
  if (goal_id) query = query.eq('goal_id', goal_id)
  if (quarter) query = query.eq('quarter', quarter)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const user = await requireRole(['manager', 'admin'])
  const supabase = await createClient()

  const body = await req.json()
  const { goal_id, quarter, comment } = body

  if (!goal_id || !quarter || !comment?.trim()) {
    return NextResponse.json({ error: 'goal_id, quarter, and comment are required' }, { status: 400 })
  }

  const VALID_QUARTERS = ['q1', 'q2', 'q3', 'q4']
  if (!VALID_QUARTERS.includes(quarter)) {
    return NextResponse.json({ error: 'Invalid quarter' }, { status: 400 })
  }

  if (user.role === 'manager') {
    const { data: goal, error: goalErr } = await supabase
      .from('goals')
      .select('employee_id, users!employee_id(manager_id)')
      .eq('id', goal_id)
      .single()

    if (goalErr || !goal) {
      return NextResponse.json({ error: 'Goal not found' }, { status: 404 })
    }
  }

  const { data, error } = await supabase
    .from('checkin_comments')
    .insert({
      goal_id,
      manager_id: user.id,
      quarter,
      comment: comment.trim(),
      created_at: new Date().toISOString(),
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
