import { createClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth'
import { FileText, Download } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import { AchievementFilters } from '@/components/reports/achievement-filters'

interface SearchParams {
  department?: string
  cycle_id?: string
  quarter?: string
  status?: string
}

async function fetchAchievements(filters: SearchParams) {
  const supabase = await createClient()

  let query = supabase
    .from('goal_achievements')
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
    .limit(500)

  if (filters.quarter) query = query.eq('quarter', filters.quarter)
  if (filters.status) query = query.eq('status', filters.status)
  if (filters.cycle_id) query = (query as any).eq('goals.cycle_id', filters.cycle_id)
  if (filters.department) query = (query as any).eq('goals.users.department', filters.department)

  const { data, error } = await query
  if (error) throw new Error(error.message)
  return data ?? []
}

async function fetchFilterOptions() {
  const supabase = await createClient()
  const [depts, cycles] = await Promise.all([
    supabase.from('users').select('department').neq('department', null),
    supabase.from('goal_cycles').select('id, name').order('window_open', { ascending: false }),
  ])

  const departments = [...new Set((depts.data ?? []).map((d: any) => d.department).filter(Boolean))] as string[]
  return { departments, cycles: cycles.data ?? [] }
}

function statusColor(status: string) {
  if (status === 'completed') return 'text-emerald-700 bg-emerald-50'
  if (status === 'on_track') return 'text-blue-700 bg-blue-50'
  return 'text-amber-700 bg-amber-50'
}

function scoreColor(score: number) {
  if (score >= 80) return 'text-emerald-700 font-semibold'
  if (score >= 50) return 'text-amber-700 font-semibold'
  return 'text-red-600 font-semibold'
}

function buildExportUrl(params: SearchParams) {
  const q = new URLSearchParams()
  if (params.department) q.set('department', params.department)
  if (params.cycle_id) q.set('cycle_id', params.cycle_id)
  if (params.quarter) q.set('quarter', params.quarter)
  if (params.status) q.set('status', params.status)
  return `/api/reports/achievement?${q.toString()}`
}

export default async function AchievementReportPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  await requireRole(['admin', 'manager'])
  const params = await searchParams
  const [rows, { departments, cycles }] = await Promise.all([
    fetchAchievements(params),
    fetchFilterOptions(),
  ])

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-7xl px-4 py-8">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <FileText className="text-blue-600" size={24} />
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Achievement Report</h1>
              <p className="text-sm text-gray-500">{rows.length} records</p>
            </div>
          </div>
          <a
            href={buildExportUrl(params)}
            className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 transition-colors"
          >
            <Download size={15} />
            Export CSV
          </a>
        </div>

        <AchievementFilters
          departments={departments}
          cycles={cycles}
          current={params}
        />

        <div className="mt-4 overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-gray-100">
            <thead className="bg-gray-50">
              <tr>
                {[
                  'Employee',
                  'Department',
                  'Cycle',
                  'Goal',
                  'UoM',
                  'Target',
                  'Quarter',
                  'Actual',
                  'Score %',
                  'Status',
                  'Submitted',
                ].map((h) => (
                  <th
                    key={h}
                    className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={11} className="px-4 py-12 text-center text-gray-400">
                    No records found
                  </td>
                </tr>
              ) : (
                rows.map((row: any) => {
                  const goal = row.goals
                  const user = goal?.users
                  const cycle = goal?.goal_cycles
                  const score = Number(row.computed_score ?? 0)
                  return (
                    <tr key={row.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">
                        {user?.full_name ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {user?.department ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {cycle?.name ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900 max-w-xs">
                        {goal?.title ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500">
                        {goal?.uom_type ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {goal?.target ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-xs font-medium uppercase text-gray-700">
                        {row.quarter}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {row.actual_achievement || '—'}
                      </td>
                      <td className={`px-4 py-3 text-sm ${scoreColor(score)}`}>
                        {score.toFixed(1)}%
                      </td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusColor(row.status)}`}>
                          {row.status?.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500">
                        {row.submitted_at ? formatDate(row.submitted_at) : '—'}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
