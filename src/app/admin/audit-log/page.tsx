import { createClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth'
import { Shield, ChevronLeft, ChevronRight } from 'lucide-react'
import { AuditLogFilters } from '@/components/admin/audit-log-filters'
import { EnhancedJsonDiffView } from '@/components/admin/enhanced-json-diff-view'
import { RelativeTime } from '@/components/admin/relative-time'

const PAGE_SIZE = 20

interface SearchParams {
  table_name?: string
  change_type?: string
  date_from?: string
  date_to?: string
  page?: string
}

async function fetchAuditLogs(filters: SearchParams) {
  const supabase = await createClient()
  const page = Math.max(1, parseInt(filters.page ?? '1', 10))
  const from = (page - 1) * PAGE_SIZE
  const to = from + PAGE_SIZE - 1

  let query = supabase
    .from('audit_log')
    .select(
      `
      id,
      table_name,
      record_id,
      changed_by,
      change_type,
      old_value,
      new_value,
      changed_at,
      users!changed_by (full_name)
    `,
      { count: 'exact' }
    )
    .order('changed_at', { ascending: false })
    .range(from, to)

  if (filters.table_name) query = query.eq('table_name', filters.table_name)
  if (filters.change_type) query = query.eq('change_type', filters.change_type)
  if (filters.date_from) query = query.gte('changed_at', filters.date_from)
  if (filters.date_to) query = query.lte('changed_at', filters.date_to + 'T23:59:59')

  const { data, error, count } = await query
  if (error) throw new Error(error.message)
  return { data: data ?? [], total: count ?? 0, page, totalPages: Math.ceil((count ?? 0) / PAGE_SIZE) }
}

async function fetchTableNames() {
  const supabase = await createClient()
  const { data } = await supabase
    .from('audit_log')
    .select('table_name')
  const names = [...new Set((data ?? []).map((r: any) => r.table_name).filter(Boolean))] as string[]
  return names
}

function changeTypeBadge(type: string) {
  const map: Record<string, string> = {
    insert: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
    update: 'bg-blue-50 text-blue-700 ring-1 ring-blue-200',
    delete: 'bg-red-50 text-red-700 ring-1 ring-red-200',
  }
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${map[type] ?? 'bg-slate-100 text-slate-600'}`}>
      {type}
    </span>
  )
}

function buildPageUrl(params: SearchParams, page: number) {
  const q = new URLSearchParams()
  if (params.table_name) q.set('table_name', params.table_name)
  if (params.change_type) q.set('change_type', params.change_type)
  if (params.date_from) q.set('date_from', params.date_from)
  if (params.date_to) q.set('date_to', params.date_to)
  q.set('page', String(page))
  return `/admin/audit-log?${q.toString()}`
}

export default async function AuditLogPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  await requireRole('admin')
  const params = await searchParams
  const [{ data, total, page, totalPages }, tableNames] = await Promise.all([
    fetchAuditLogs(params),
    fetchTableNames(),
  ])

  const rangeFrom = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1
  const rangeTo = Math.min(page * PAGE_SIZE, total)

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100/50">
      {/* Sticky frosted glass filter bar */}
      <div className="sticky top-0 z-10 bg-white/80 backdrop-blur-sm border-b border-slate-200/60 shadow-sm">
        <div className="mx-auto max-w-7xl px-4 py-3">
          <AuditLogFilters tableNames={tableNames} current={params} />
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-8">
        {/* Page header */}
        <div className="mb-6 flex items-center gap-3">
          <div className="rounded-xl bg-gradient-to-br from-slate-700 to-slate-900 p-2.5 shadow-sm">
            <Shield className="text-white" size={20} />
          </div>
          <div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-slate-700 to-slate-900 bg-clip-text text-transparent">
              Audit Log
            </h1>
            <p className="text-sm text-slate-500">
              {total > 0
                ? `Showing ${rangeFrom}–${rangeTo} of ${total} records`
                : 'No audit records'}
            </p>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto rounded-2xl bg-white shadow-sm border border-slate-200/80">
          <table className="min-w-full">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-100">
                {['Timestamp', 'Table', 'Record ID', 'Changed By', 'Action', 'Changes'].map(
                  (h) => (
                    <th
                      key={h}
                      className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-slate-400"
                    >
                      {h}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-16 text-center text-slate-400 text-sm">
                    No audit records found — try adjusting your filters
                  </td>
                </tr>
              ) : (
                data.map((row: any, i: number) => (
                  <tr
                    key={row.id}
                    className={`hover:bg-slate-50 transition-colors align-top ${i % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'}`}
                  >
                    <td className="px-4 py-3 whitespace-nowrap">
                      <RelativeTime timestamp={row.changed_at} />
                    </td>
                    <td className="px-4 py-3 text-sm font-mono text-slate-700">{row.table_name}</td>
                    <td className="px-4 py-3 text-xs font-mono text-slate-400 max-w-[120px] truncate" title={row.record_id}>
                      {row.record_id}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-700">
                      {row.users?.full_name ?? row.changed_by?.slice(0, 8) + '…'}
                    </td>
                    <td className="px-4 py-3">{changeTypeBadge(row.change_type)}</td>
                    <td className="px-4 py-3">
                      <EnhancedJsonDiffView old_value={row.old_value} new_value={row.new_value} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="mt-5 flex items-center justify-between">
            <p className="text-sm text-slate-500">
              Showing <span className="font-medium text-slate-700">{rangeFrom}–{rangeTo}</span> of{' '}
              <span className="font-medium text-slate-700">{total}</span> records
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
              {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                const p = Math.max(1, Math.min(page - 2, totalPages - 4)) + i
                if (p < 1 || p > totalPages) return null
                return (
                  <a
                    key={p}
                    href={buildPageUrl(params, p)}
                    className={`inline-flex items-center justify-center rounded-full w-8 h-8 text-sm font-medium transition-all ${
                      p === page
                        ? 'bg-slate-800 text-white shadow-sm'
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
