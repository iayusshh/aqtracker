import { createClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth'
import { Shield } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import { AuditLogFilters } from '@/components/admin/audit-log-filters'
import { JsonDiffView } from '@/components/admin/json-diff-view'

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
    .from('audit_logs')
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
    .from('audit_logs')
    .select('table_name')
  const names = [...new Set((data ?? []).map((r: any) => r.table_name).filter(Boolean))] as string[]
  return names
}

function changeTypeBadge(type: string) {
  const map: Record<string, string> = {
    insert: 'bg-blue-100 text-blue-700',
    update: 'bg-amber-100 text-amber-700',
    delete: 'bg-red-100 text-red-600',
  }
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${map[type] ?? 'bg-gray-100 text-gray-600'}`}>
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

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-7xl px-4 py-8">
        <div className="mb-6 flex items-center gap-3">
          <Shield className="text-blue-600" size={24} />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Audit Log</h1>
            <p className="text-sm text-gray-500">{total} total records</p>
          </div>
        </div>

        <AuditLogFilters tableNames={tableNames} current={params} />

        <div className="mt-4 overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-gray-100">
            <thead className="bg-gray-50">
              <tr>
                {['Timestamp', 'Table', 'Record ID', 'Changed By', 'Action', 'Changes'].map(
                  (h) => (
                    <th
                      key={h}
                      className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500"
                    >
                      {h}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-gray-400">
                    No audit records found
                  </td>
                </tr>
              ) : (
                data.map((row: any) => (
                  <tr key={row.id} className="hover:bg-gray-50 transition-colors align-top">
                    <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                      {formatDate(row.changed_at)}
                      <br />
                      <span className="text-gray-400">
                        {new Date(row.changed_at).toLocaleTimeString('en-IN')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm font-mono text-gray-700">{row.table_name}</td>
                    <td className="px-4 py-3 text-xs font-mono text-gray-500 max-w-xs truncate">
                      {row.record_id}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {row.users?.full_name ?? row.changed_by?.slice(0, 8) + '…'}
                    </td>
                    <td className="px-4 py-3">{changeTypeBadge(row.change_type)}</td>
                    <td className="px-4 py-3">
                      <JsonDiffView old_value={row.old_value} new_value={row.new_value} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="mt-4 flex items-center justify-between">
            <p className="text-sm text-gray-500">
              Page {page} of {totalPages} ({total} records)
            </p>
            <div className="flex gap-2">
              {page > 1 && (
                <a
                  href={buildPageUrl(params, page - 1)}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Previous
                </a>
              )}
              {page < totalPages && (
                <a
                  href={buildPageUrl(params, page + 1)}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Next
                </a>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
