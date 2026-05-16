import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/auth'
import { writeAuditLog } from '@/lib/audit'

type Params = { params: Promise<{ id: string }> }

/**
 * POST /api/goals/[id]/return
 * Manager only. Moves status: submitted → returned. Requires a comment.
 */
export async function POST(request: NextRequest, { params }: Params) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (user.role !== 'manager' && user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden: manager or admin role required' }, { status: 403 })
  }

  const { id } = await params
  const body: { comment?: string } = await request.json().catch(() => ({}))

  if (!body.comment?.trim()) {
    return NextResponse.json({ error: 'A return comment is required' }, { status: 400 })
  }

  const supabase = await createClient()

  const { data: goal, error: fetchErr } = await supabase
    .from('goals')
    .select('*, employee:users!goals_employee_id_fkey(id, manager_id)')
    .eq('id', id)
    .single()

  if (fetchErr || !goal) return NextResponse.json({ error: 'Goal not found' }, { status: 404 })

  if (user.role === 'manager' && goal.employee?.manager_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden: not a direct report' }, { status: 403 })
  }

  if (goal.status !== 'submitted') {
    return NextResponse.json({ error: `Goal must be "submitted" to return. Current status: "${goal.status}"` }, { status: 409 })
  }

  const { data: updated, error: updateErr } = await supabase
    .from('goals')
    .update({ status: 'returned', updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 })

  await writeAuditLog(supabase, {
    tableName: 'goals',
    recordId: id,
    changedBy: user.id,
    changeType: 'update',
    oldValue: { status: goal.status },
    newValue: { status: 'returned', return_comment: body.comment },
  })

  return NextResponse.json({ goal: updated, comment: body.comment })
}
