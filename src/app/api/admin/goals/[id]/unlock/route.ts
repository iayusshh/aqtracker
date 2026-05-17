import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth'

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const user = await requireRole('admin')
  const supabase = await createClient()

  const { data: existing, error: fetchErr } = await supabase
    .from('goals')
    .select('*')
    .eq('id', id)
    .single()

  if (fetchErr || !existing) {
    return NextResponse.json({ error: 'Goal not found' }, { status: 404 })
  }

  const oldStatus = existing.status

  const { data, error } = await supabase
    .from('goals')
    .update({ status: 'draft' })
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await supabase.from('audit_log').insert({
    table_name: 'goals',
    record_id: id,
    changed_by: user.id,
    change_type: 'update',
    old_value: { status: oldStatus },
    new_value: { status: 'draft' },
    changed_at: new Date().toISOString(),
  })

  return NextResponse.json({
    success: true,
    goal: data,
    message: `Goal unlocked from '${oldStatus}' to 'draft'`,
  })
}
