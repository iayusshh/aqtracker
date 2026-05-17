import { createClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth'
import { Download, FileText, ChevronLeft, ChevronRight } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import { AchievementFilters } from '@/components/reports/achievement-filters'
import { ShimmerButton } from '@/components/ui/shimmer-button'

const PAGE_SIZE = 50

interface SearchParams {
  department?: string
  cycle_id?: string
  quarter?: string
  status?: string
  page?: string
}

async function fetchAchievements(filters: SearchParams) {
  const supabase = await createClient()
  const page = Math.max(1, parseInt(filters.page ?? '1', 10))
  const from = (page - 1) * PAGE_SIZE
  const to = from + PAGE_SIZE - 1
  const empty = { data: [], total: 0, page, totalPages: 0 }

  // PostgREST doesn't support two-level nested filters (goals.users.department).
  // Pre-fetch matching goal IDs when department or cycle filters are active.
  let goalIdFilter: string[] | null = null
  if (filters.department || filters.cycle_id) {
    let goalsQ = supabase.from('goals').select('id')
    if (filters.cycle_id) goalsQ = goalsQ.eq('cycle_id', filters.cycle_id)
    if (filters.department) {
      const { data: empRows } = await supabase
        .from('users').select('id').eq('department', filters.department)
      const empIds = (empRows ?? []).map((u: { id: string }) => u.id)
      if (empIds.length === 0) return empty
      goalsQ = goalsQ.in('employee_id', empIds)
    }
    const { data: goalRows } = await goalsQ
    goalIdFilter = (goalRows ?? []).map((g: { id: string }) => g.id)
    if (goalIdFilter.length === 0) return empty
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
    `, { count: 'exact' })
    .order('submitted_at', { ascending: false })
    .range(from, to)

  if (filters.quarter) query = query.eq('quarter', filters.quarter)
  if (filters.status) query = query.eq('status', filters.status)
  if (goalIdFilter) query = query.in('goal_id', goalIdFilter)

  const { data, error, count } = await query
  if (error) throw new Error(error.message)
  return { data: data ?? [], total: count ?? 0, page, totalPages: Math.ceil((count ?? 0) / PAGE_SIZE) }
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
  if (status === 'completed') return 'text-emerald-700 bg-emerald-50 ring-1 ring-emerald-200'
  if (status === 'on_track') return 'text-blue-700 bg-blue-50 ring-1 ring-blue-200'
  return 'text-amber-700 bg-amber-50 ring-1 ring-amber-200'
}

function scoreColorClass(score: number) {
  if (score >= 80) return { text: 'text-emerald-700 font-semibold', bar: 'bg-emerald-500' }
  if (score >= 50) return { text: 'text-amber-700 font-semibold', bar: 'bg-amber-500' }
  return { text: 'text-red-600 font-semibold', bar: 'bg-red-500' }
}

function buildExportUrl(params: SearchParams) {
  const q = new URLSearchParams()
  if (params.department) q.set('department', params.department)
  if (params.cycle_id) q.set('cycle_id', params.cycle_id)
  if (params.quarter) q.set('quarter', params.quarter)
  if (params.status) q.set('status', params.status)
  return `/api/reports/achievement?${q.toString()}`
}

function buildPageUrl(params: SearchParams, page: number) {
  const q = new URLSearchParams()
  if (params.department) q.set('department', params.department)
  if (params.cycle_id) q.set('cycle_id', params.cycle_id)
  if (params.quarter) q.set('quarter', params.quarter)
  if (params.status) q.set('status', params.status)
  q.set('page', String(page))
  return `/reports/achievement?${q.toString()}`
}

export default async function AchievementReportPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  await requireRole(['admin', 'manager'])
  const params = await searchParams
  const [{ data: rows, total, page, totalPages }, { departments, cycles }] = await Promise.all([
    fetchAchievements(params),
    fetchFilterOptions(),
  ])

  const rangeFrom = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1
  const rangeTo = Math.min(page * PAGE_SIZE, total)

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/20">
      {/* Sticky filter bar */}
      <div className="sticky top-0 z-10 bg-white/80 backdrop-blur-sm border-b border-slate-200/60 shadow-sm">
        <div className="mx-auto max-w-7xl px-4 py-3">
          <AchievementFilters departments={departments} cycles={cycles} current={params} />
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-8">
        {/* Page header */}
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 p-2.5 shadow-sm">
              <FileText className="text-white" size={20} />
            </div>
            <div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                Achievement Report
              </h1>
              <p className="text-sm text-slate-500">
                {total > 0 ? `Showing ${rangeFrom}–${rangeTo} of ${total} records` : 'No records found'}
              </p>
            </div>
          </div>
          <a href={buildExportUrl(params)}>
            <ShimmerButton background="rgba(79,70,229,1)" className="gap-1.5 px-4 py-2 text-sm">
              <Download size={15} />
              Export CSV
            </ShimmerButton>
          </a>
        </div>

        {/* Table */}
        <div className="overflow-x-auto rounded-2xl bg-white shadow-sm border border-slate-200/80">
          <table className="min-w-full">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-100">
                {[
                  'Employee',
                  'Department',
                  'Cycle',
                  'Goal',
                  'UoM',
                  'Target',
                  'Quarter',
                  'Actual',
                  'Score',
                  'Status',
                  'Submitted',
                ].map((h) => (
                  <th
                    key={h}
                    className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-slate-400"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={11} className="px-4 py-16 text-center text-slate-400 text-sm">
                    No records found — try adjusting your filters
                  </td>
                </tr>
              ) : (
                rows.map((row: any, i: number) => {
                  const goal = row.goals
                  const user = goal?.users
                  const cycle = goal?.goal_cycles
                  const score = Number(row.computed_score ?? 0)
                  const { text: scoreText, bar: scoreBar } = scoreColorClass(score)
                  const barWidth = Math.min(Math.round((score / 100) * 60), 60)
                  return (
                    <tr
                      key={row.id}
                      className={`hover:bg-indigo-50/20 transition-colors ${i % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'}`}
                    >
                      <td className="px-4 py-3 text-sm font-medium text-slate-800">
                        {user?.full_name ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-500">
                        {user?.department ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-500">
                        {cycle?.name ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-800 max-w-[200px] truncate">
                        {goal?.title ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-400 font-mono">
                        {goal?.uom_type ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600">
                        {goal?.target ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-600">
                        {row.quarter}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600">
                        {row.actual_achievement || '—'}
                      </td>
                      <td className="px-4 py-3">
                        <div>
                          <span className={`text-sm ${scoreText}`}>{score.toFixed(1)}%</span>
                          <div className="mt-1 h-1 rounded-full bg-slate-100 overflow-hidden" style={{ width: '60px' }}>
                            <div
                              className={`h-full rounded-full ${scoreBar}`}
                              style={{ width: `${barWidth}px` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColor(row.status)}`}>
                          {row.status?.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-400 whitespace-nowrap">
                        {row.submitted_at ? formatDate(row.submitted_at) : '—'}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="mt-5 flex items-center justify-between">
            <p className="text-sm text-slate-500">
              Showing <span className="font-medium text-slate-700">{rangeFrom}–{rangeTo}</span> of{' '}
              <span className="font-medium text-slate-700">{total}</span> results
            </p>
            <div className="flex items-center gap-1.5">
              {page > 1 && (
                <a
                  href={buildPageUrl(params, page - 1)}
                  className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-all shadow-sm"
                >
                  <ChevronLeft size={14} />
                  Prev
                </a>
              )}

              {/* Page numbers */}
              {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                const p = Math.max(1, Math.min(page - 2, totalPages - 4)) + i
                if (p < 1 || p > totalPages) return null
                return (
                  <a
                    key={p}
                    href={buildPageUrl(params, p)}
                    className={`inline-flex items-center justify-center rounded-full w-8 h-8 text-sm font-medium transition-all ${
                      p === page
                        ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-200'
                        : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {p}
                  </a>
                )
              })}

              {page < totalPages && (
                <a
                  href={buildPageUrl(params, page + 1)}
                  className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-all shadow-sm"
                >
                  Next
                  <ChevronRight size={14} />
                </a>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
