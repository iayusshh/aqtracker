'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { Users, CheckSquare, Clock, TrendingUp } from 'lucide-react'
import { cn, getQuarterWindow } from '@/lib/utils'
import { NumberTicker } from '@/components/ui/number-ticker'
import { BorderBeam } from '@/components/ui/border-beam'

interface DeptStat {
  department: string
  completionPct: number
  total: number
  completed: number
}

interface EmployeeRow {
  id: string
  full_name: string
  department: string
  hasGoals: boolean
  approved: boolean
  checkinDone: boolean
}

interface Stats {
  totalEmployees: number
  submittedGoals: number
  pendingApprovals: number
  checkinsCompleted: number
}

function detectCurrentQuarter(): string {
  const now = new Date()
  const quarters = ['q1', 'q2', 'q3', 'q4']
  for (const q of quarters) {
    const w = getQuarterWindow(q)
    if (now >= w.open && now <= w.close) return q
  }
  return 'q1'
}

interface StatCardProps {
  icon: React.ElementType
  label: string
  value: number
  color: string
  borderColor: string
  highlight?: boolean
  suffix?: string
  prefix?: string
}

function StatCard({ icon: Icon, label, value, color, borderColor, highlight = false, suffix = '', prefix = '' }: StatCardProps) {
  return (
    <div className={cn(
      'relative rounded-xl border border-slate-200 bg-white p-5 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 overflow-hidden',
      'border-l-4',
      borderColor,
    )}>
      {highlight && <BorderBeam size={180} duration={10} />}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide font-medium text-slate-400">{label}</p>
          <p className="mt-1.5 text-3xl font-bold text-slate-900">
            <NumberTicker value={value} prefix={prefix} suffix={suffix} />
          </p>
        </div>
        <div className={cn('rounded-xl p-3 shadow-sm', color)}>
          <Icon size={22} className="text-white" />
        </div>
      </div>
    </div>
  )
}

interface CustomTooltipProps {
  active?: boolean
  payload?: Array<{ value: number }>
  label?: string
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white rounded-xl shadow-lg border border-slate-200 px-4 py-3">
      <p className="text-xs font-semibold text-slate-500 mb-1">{label}</p>
      <p className="text-lg font-bold text-indigo-600">{payload[0].value}%</p>
      <p className="text-xs text-slate-400">completion rate</p>
    </div>
  )
}

export default function CompletionDashboard() {
  const [stats, setStats] = useState<Stats>({
    totalEmployees: 0,
    submittedGoals: 0,
    pendingApprovals: 0,
    checkinsCompleted: 0,
  })
  const [deptStats, setDeptStats] = useState<DeptStat[]>([])
  const [employeeRows, setEmployeeRows] = useState<EmployeeRow[]>([])
  const [loading, setLoading] = useState(true)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const currentQuarter = detectCurrentQuarter()

  useEffect(() => {
    const supabase = createClient()

    async function load() {
      const [usersRes, goalsRes, achRes] = await Promise.all([
        supabase.from('users').select('id, full_name, department').eq('role', 'employee'),
        supabase.from('goals').select('id, employee_id, status'),
        supabase
          .from('quarterly_achievements')
          .select('id, goal_id, quarter, status')
          .eq('quarter', currentQuarter),
      ])

      const allUsers = usersRes.data ?? []
      const allGoals = goalsRes.data ?? []
      const allAch = achRes.data ?? []

      const achGoalIds = new Set(allAch.map((a: any) => a.goal_id))

      const employeeGoalsMap: Record<string, typeof allGoals> = {}
      for (const g of allGoals) {
        if (!employeeGoalsMap[g.employee_id]) employeeGoalsMap[g.employee_id] = []
        employeeGoalsMap[g.employee_id].push(g)
      }

      let submittedCount = 0
      let pendingCount = 0
      let checkinCount = 0

      const rows: EmployeeRow[] = allUsers.map((u: any) => {
        const empGoals = employeeGoalsMap[u.id] ?? []
        const hasGoals = empGoals.length > 0
        const approved = empGoals.some((g) => g.status === 'approved' || g.status === 'locked')
        const checkinDone = empGoals.some((g) => achGoalIds.has(g.id))

        if (hasGoals) submittedCount++
        if (empGoals.some((g) => g.status === 'submitted')) pendingCount++
        if (checkinDone) checkinCount++

        return {
          id: u.id,
          full_name: u.full_name,
          department: u.department,
          hasGoals,
          approved,
          checkinDone,
        }
      })

      setStats({
        totalEmployees: allUsers.length,
        submittedGoals: submittedCount,
        pendingApprovals: pendingCount,
        checkinsCompleted: checkinCount,
      })

      const deptMap: Record<string, { total: number; completed: number }> = {}
      for (const row of rows) {
        const dept = row.department || 'Unknown'
        if (!deptMap[dept]) deptMap[dept] = { total: 0, completed: 0 }
        deptMap[dept].total++
        if (row.checkinDone) deptMap[dept].completed++
      }

      setDeptStats(
        Object.entries(deptMap).map(([department, { total, completed }]) => ({
          department,
          total,
          completed,
          completionPct: total > 0 ? Math.round((completed / total) * 100) : 0,
        }))
      )

      setEmployeeRows(rows)
      setLastUpdated(new Date())
      setLoading(false)
    }

    load()
    const interval = setInterval(load, 30000)
    return () => clearInterval(interval)
  }, [currentQuarter])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent" />
      </div>
    )
  }

  const completionRate = stats.totalEmployees > 0
    ? Math.round((stats.checkinsCompleted / stats.totalEmployees) * 100)
    : 0

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-violet-50/20">
      <div className="mx-auto max-w-7xl px-4 py-8">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 p-2.5 shadow-sm">
              <TrendingUp className="text-white" size={20} />
            </div>
            <div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent">
                Completion Dashboard
              </h1>
              <p className="text-sm text-slate-500">
                Current quarter: <span className="font-medium text-slate-700">{currentQuarter.toUpperCase()}</span>
              </p>
            </div>
          </div>

          {/* Live indicator */}
          <div className="flex items-center gap-2 rounded-full bg-white border border-slate-200 px-3 py-1.5 shadow-sm">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
            <span className="text-xs font-medium text-slate-600">Live</span>
          </div>
        </div>

        {/* Stat cards */}
        <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatCard
            icon={Users}
            label="Total Employees"
            value={stats.totalEmployees}
            color="bg-blue-500"
            borderColor="border-l-blue-400"
          />
          <StatCard
            icon={CheckSquare}
            label="Submitted Goals"
            value={stats.submittedGoals}
            color="bg-emerald-500"
            borderColor="border-l-emerald-400"
          />
          <StatCard
            icon={Clock}
            label="Pending Approvals"
            value={stats.pendingApprovals}
            color="bg-amber-500"
            borderColor="border-l-amber-400"
          />
          <StatCard
            icon={TrendingUp}
            label="Completion Rate"
            value={completionRate}
            color="bg-violet-500"
            borderColor="border-l-violet-400"
            highlight
            suffix="%"
          />
        </div>

        {/* Department bar chart */}
        <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="mb-5 text-base font-semibold text-slate-800">
            Check-in Completion by Department
          </h2>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={deptStats} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="deptGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#818cf8" stopOpacity={1} />
                  <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0.8} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="4 4" stroke="#f1f5f9" vertical={false} />
              <XAxis
                dataKey="department"
                tick={{ fontSize: 12, fill: '#94a3b8' }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                tickFormatter={(v) => `${v}%`}
                domain={[0, 100]}
                tick={{ fontSize: 12, fill: '#94a3b8' }}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f8fafc' }} />
              <Bar
                dataKey="completionPct"
                fill="url(#deptGradient)"
                radius={[6, 6, 0, 0]}
                maxBarSize={64}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Employee table */}
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="border-b border-slate-100 px-6 py-4 flex items-center justify-between">
            <h2 className="text-base font-semibold text-slate-800">Employee Status Grid</h2>
            <span className="text-xs text-slate-400">
              {lastUpdated && `Updated ${lastUpdated.toLocaleTimeString('en-IN')}`}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="bg-slate-50/80">
                  {['Employee', 'Department', 'Goals Set', 'Approved', `${currentQuarter.toUpperCase()} Check-in`].map(
                    (h) => (
                      <th
                        key={h}
                        className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wide text-slate-400"
                      >
                        {h}
                      </th>
                    )
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {employeeRows.map((row, i) => (
                  <tr
                    key={row.id}
                    className={cn(
                      'transition-colors hover:bg-indigo-50/30',
                      i % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'
                    )}
                  >
                    <td className="px-5 py-3.5 text-sm font-medium text-slate-800">{row.full_name}</td>
                    <td className="px-5 py-3.5 text-sm text-slate-500">{row.department || '—'}</td>
                    <td className="px-5 py-3.5">
                      <StatusCell value={row.hasGoals} />
                    </td>
                    <td className="px-5 py-3.5">
                      <StatusCell value={row.approved} />
                    </td>
                    <td className="px-5 py-3.5">
                      <CheckinCell value={row.checkinDone} />
                    </td>
                  </tr>
                ))}
                {employeeRows.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-5 py-16 text-center text-slate-400 text-sm">
                      No employee data found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}

function StatusCell({ value }: { value: boolean }) {
  if (value) {
    return (
      <span className="inline-flex items-center gap-1.5 text-sm text-emerald-600">
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-100">
          <svg className="h-3 w-3" viewBox="0 0 12 12" fill="none">
            <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
        <span className="text-xs font-medium">Done</span>
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-sm text-amber-600">
      <span className="h-2 w-2 rounded-full bg-amber-400" />
      <span className="text-xs font-medium text-slate-400">Pending</span>
    </span>
  )
}

function CheckinCell({ value }: { value: boolean }) {
  if (value) {
    return (
      <span className="inline-flex items-center gap-1.5 text-sm text-emerald-600">
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-100">
          <svg className="h-3 w-3" viewBox="0 0 12 12" fill="none">
            <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
        <span className="text-xs font-medium">Completed</span>
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="text-slate-300 font-medium">—</span>
      <span className="text-xs text-slate-400">Not started</span>
    </span>
  )
}
