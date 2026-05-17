import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth'

export async function GET(_req: NextRequest) {
  await requireRole('admin')
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('goal_cycles')
    .select('*')
    .order('window_open', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const user = await requireRole('admin')
  const supabase = await createClient()

  const body = await req.json()
  const { name, phase, window_open, window_close, status } = body

  if (!name || !phase || !window_open || !window_close) {
    return NextResponse.json({ error: 'name, phase, window_open, window_close are required' }, { status: 400 })
  }

  const VALID_PHASES = ['goal_setting', 'q1', 'q2', 'q3', 'q4_annual']
  if (!VALID_PHASES.includes(phase)) {
    return NextResponse.json({ error: 'Invalid phase' }, { status: 400 })
  }

  if (new Date(window_open) >= new Date(window_close)) {
    return NextResponse.json({ error: 'window_open must be before window_close' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('goal_cycles')
    .insert({ name, phase, window_open, window_close, status: status ?? 'draft' })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await supabase.from('audit_log').insert({
    table_name: 'goal_cycles',
    record_id: data.id,
    changed_by: user.id,
    change_type: 'insert',
    old_value: null,
    new_value: data,
    changed_at: new Date().toISOString(),
  })

  return NextResponse.json(data, { status: 201 })
}

export async function PATCH(req: NextRequest) {
  const user = await requireRole('admin')
  const supabase = await createClient()

  const body = await req.json()
  const { id, ...updates } = body

  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

  const { data: existing, error: fetchErr } = await supabase
    .from('goal_cycles')
    .select('*')
    .eq('id', id)
    .single()

  if (fetchErr || !existing) {
    return NextResponse.json({ error: 'Cycle not found' }, { status: 404 })
  }

  if (updates.window_open && updates.window_close) {
    if (new Date(updates.window_open) >= new Date(updates.window_close)) {
      return NextResponse.json({ error: 'window_open must be before window_close' }, { status: 400 })
    }
  }

  const VALID_STATUSES = ['draft', 'active', 'closed']
  if (updates.status && !VALID_STATUSES.includes(updates.status)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('goal_cycles')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await supabase.from('audit_log').insert({
    table_name: 'goal_cycles',
    record_id: id,
    changed_by: user.id,
    change_type: 'update',
    old_value: existing,
    new_value: data,
    changed_at: new Date().toISOString(),
  })

  return NextResponse.json(data)
}

export async function DELETE(req: NextRequest) {
  const user = await requireRole('admin')
  const supabase = await createClient()
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')

  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

  const { data: existing } = await supabase.from('goal_cycles').select('*').eq('id', id).single()

  const { error } = await supabase.from('goal_cycles').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await supabase.from('audit_log').insert({
    table_name: 'goal_cycles',
    record_id: id,
    changed_by: user.id,
    change_type: 'delete',
    old_value: existing ?? null,
    new_value: null,
    changed_at: new Date().toISOString(),
  })

  return NextResponse.json({ success: true })
}
