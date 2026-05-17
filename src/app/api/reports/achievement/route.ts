import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth'

function escapeCsv(value: unknown): string {
  const str = value === null || value === undefined ? '' : String(value)
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

function rowToCsv(fields: unknown[]): string {
  return fields.map(escapeCsv).join(',')
}

export async function GET(req: NextRequest) {
  await requireRole(['admin', 'manager'])
  const supabase = await createClient()
  const { searchParams } = new URL(req.url)

  const department = searchParams.get('department')
  const cycle_id = searchParams.get('cycle_id')
  const quarter = searchParams.get('quarter')
  const status = searchParams.get('status')

  // Pre-fetch goal IDs when department or cycle filters are active
  let goalIdFilter: string[] | null = null
  if (department || cycle_id) {
    let goalsQ = supabase.from('goals').select('id')
    if (cycle_id) goalsQ = goalsQ.eq('cycle_id', cycle_id)
    if (department) {
      const { data: empRows } = await supabase
        .from('users').select('id').eq('department', department)
      const empIds = (empRows ?? []).map((u: { id: string }) => u.id)
      if (empIds.length === 0) {
        return new NextResponse('', { status: 204 })
      }
      goalsQ = goalsQ.in('employee_id', empIds)
    }
    const { data: goalRows } = await goalsQ
    goalIdFilter = (goalRows ?? []).map((g: { id: string }) => g.id)
    if (goalIdFilter.length === 0) {
      return new NextResponse('', { status: 204 })
    }
  }

  let query = supabase
    .from('quarterly_achievements')
    .select(`
      id,
      quarter,
      actual_achievement,
      status,
      computed_score,
      submitted_at,
      goals!inner (
        id,
        title,
        uom_type,
        target,
        weightage,
        cycle_id,
        users!employee_id (
          id,
          full_name,
          department
        ),
        goal_cycles!cycle_id (
          id,
          name
        )
      )
    `)
    .order('submitted_at', { ascending: false })

  if (quarter) query = query.eq('quarter', quarter)
  if (status) query = query.eq('status', status)
  if (goalIdFilter) query = query.in('goal_id', goalIdFilter)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const BOM = '﻿'
  const headers = [
    'Employee',
    'Department',
    'Cycle',
    'Goal',
    'UoM Type',
    'Target',
    'Quarter',
    'Actual',
    'Score %',
    'Status',
    'Submitted At',
  ]

  const rows = (data ?? []).map((row: any) => {
    const goal = row.goals
    const user = goal?.users
    const cycle = goal?.goal_cycles
    return rowToCsv([
      user?.full_name ?? '',
      user?.department ?? '',
      cycle?.name ?? '',
      goal?.title ?? '',
      goal?.uom_type ?? '',
      goal?.target ?? '',
      row.quarter ?? '',
      row.actual_achievement ?? '',
      row.computed_score != null ? Number(row.computed_score).toFixed(2) : '',
      row.status ?? '',
      row.submitted_at ? new Date(row.submitted_at).toISOString() : '',
    ])
  })

  const csv = BOM + [rowToCsv(headers), ...rows].join('\r\n')

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="achievement-report.csv"',
    },
  })
}
