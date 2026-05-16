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
  Cell,
} from 'recharts'
import { Users, CheckSquare, Clock, TrendingUp } from 'lucide-react'
import { cn, getQuarterWindow } from '@/lib/utils'

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

function StatCard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: React.ElementType
  label: string
  value: number
  color: string
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500">{label}</p>
          <p className="mt-1 text-3xl font-bold text-gray-900">{value}</p>
        </div>
        <div className={cn('rounded-xl p-3', color)}>
          <Icon size={22} className="text-white" />
        </div>
      </div>
    </div>
  )
}

const BAR_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4']

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
  const currentQuarter = detectCurrentQuarter()

  useEffect(() => {
    const supabase = createClient()

    async function load() {
      const [usersRes, goalsRes, achRes] = await Promise.all([
        supabase.from('users').select('id, full_name, department').eq('role', 'employee'),
        supabase.from('goals').select('id, employee_id, status'),
        supabase
          .from('goal_achievements')
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
      setLoading(false)
    }

    load()
    const interval = setInterval(load, 30000)
    return () => clearInterval(interval)
  }, [currentQuarter])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-7xl px-4 py-8">
        <div className="mb-6 flex items-center gap-3">
          <TrendingUp className="text-blue-600" size={24} />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Completion Dashboard</h1>
            <p className="text-sm text-gray-500">
              Real-time view — current quarter: {currentQuarter.toUpperCase()}
            </p>
          </div>
        </div>

        <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatCard
            icon={Users}
            label="Total Employees"
            value={stats.totalEmployees}
            color="bg-blue-500"
          />
          <StatCard
            icon={CheckSquare}
            label="Submitted Goals"
            value={stats.submittedGoals}
            color="bg-emerald-500"
          />
          <StatCard
            icon={Clock}
            label="Pending Approvals"
            value={stats.pendingApprovals}
            color="bg-amber-500"
          />
          <StatCard
            icon={TrendingUp}
            label={`Q${currentQuarter.slice(-1) || ''} Check-ins`}
            value={stats.checkinsCompleted}
            color="bg-purple-500"
          />
        </div>

        <div className="mb-6 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-base font-semibold text-gray-900">
            Check-in Completion by Department
          </h2>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={deptStats} margin={{ top: 0, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis
                dataKey="department"
                tick={{ fontSize: 12 }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                tickFormatter={(v) => `${v}%`}
                domain={[0, 100]}
                tick={{ fontSize: 12 }}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                formatter={(val) => [`${val}%`, 'Completion']}
                contentStyle={{
                  borderRadius: '8px',
                  border: '1px solid #e5e7eb',
                  fontSize: '13px',
                }}
              />
              <Bar dataKey="completionPct" radius={[4, 4, 0, 0]}>
                {deptStats.map((_, i) => (
                  <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
          <div className="border-b px-5 py-3">
            <h2 className="text-base font-semibold text-gray-900">Employee Status Grid</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-100">
              <thead className="bg-gray-50">
                <tr>
                  {['Employee', 'Department', 'Goals Set', 'Approved', `${currentQuarter.toUpperCase()} Check-in`].map(
                    (h) => (
                      <th
                        key={h}
                        className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500"
                      >
                        {h}
                      </th>
                    )
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {employeeRows.map((row) => (
                  <tr key={row.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3 text-sm font-medium text-gray-900">{row.full_name}</td>
                    <td className="px-5 py-3 text-sm text-gray-500">{row.department}</td>
                    <td className="px-5 py-3">
                      <StatusCell value={row.hasGoals} />
                    </td>
                    <td className="px-5 py-3">
                      <StatusCell value={row.approved} />
                    </td>
                    <td className="px-5 py-3">
                      <StatusCell value={row.checkinDone} />
                    </td>
                  </tr>
                ))}
                {employeeRows.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-5 py-12 text-center text-gray-400">
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
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
        value ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'
      )}
    >
      {value ? 'Y' : 'N'}
    </span>
  )
}
