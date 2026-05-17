'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { MessageSquare, TrendingUp, Users } from 'lucide-react'
import { cn, getQuarterWindow } from '@/lib/utils'
import { CommentModal } from '@/components/checkin/comment-modal'
import { Badge } from '@/components/ui/badge'

type Quarter = 'q1' | 'q2' | 'q3' | 'q4'

interface Achievement {
  quarter: Quarter
  actual_achievement: string
  status: 'not_started' | 'on_track' | 'completed'
  computed_score: number
}

interface Goal {
  id: string
  title: string
  uom_type: string
  target: string
  weightage: number
  quarterly_achievements: Achievement[]
}

interface Employee {
  id: string
  full_name: string
  department: string
  goals: Goal[]
}

function detectCurrentQuarter(): Quarter {
  const now = new Date()
  const candidates: Quarter[] = ['q1', 'q2', 'q3', 'q4']
  for (const q of candidates) {
    const w = getQuarterWindow(q)
    if (now >= w.open && now <= w.close) return q
  }
  return 'q1'
}

function weightedScore(goals: Goal[], quarter: Quarter): number {
  let totalWeight = 0
  let weightedSum = 0
  for (const g of goals) {
    const ach = g.quarterly_achievements.find((a) => a.quarter === quarter)
    if (ach) {
      weightedSum += (ach.computed_score ?? 0) * g.weightage
      totalWeight += g.weightage
    }
  }
  if (totalWeight === 0) return 0
  return weightedSum / totalWeight
}

function statusBadge(status?: string) {
  if (status === 'completed') return <Badge variant="green">Completed</Badge>
  if (status === 'on_track') return <Badge variant="blue">On Track</Badge>
  return <Badge variant="amber">Not Started</Badge>
}

function statusRowColor(status?: string) {
  if (status === 'completed') return 'bg-emerald-50'
  if (status === 'on_track') return 'bg-blue-50'
  return 'bg-red-50'
}

export default function ManagerCheckinsPage() {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)
  const [activeQuarter, setActiveQuarter] = useState<Quarter>(detectCurrentQuarter)
  const [commentModal, setCommentModal] = useState<{
    goalId: string
    goalTitle: string
  } | null>(null)
  const [refreshTick, setRefreshTick] = useState(0)

  useEffect(() => {
    const supabase = createClient()
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: reports } = await supabase
        .from('users')
        .select('id, full_name, department')
        .eq('manager_id', user.id)

      if (!reports?.length) { setLoading(false); return }

      const reportIds = reports.map((r) => r.id)
      const { data: goalsData } = await supabase
        .from('goals')
        .select(`
          id, title, uom_type, target, weightage, employee_id,
          quarterly_achievements (quarter, actual_achievement, status, computed_score)
        `)
        .in('employee_id', reportIds)
        .in('status', ['approved', 'locked'])

      const employeeMap: Record<string, Employee> = {}
      for (const r of reports) {
        employeeMap[r.id] = { ...r, goals: [] }
      }
      for (const g of goalsData ?? []) {
        if (employeeMap[g.employee_id]) {
          employeeMap[g.employee_id].goals.push(g as Goal)
        }
      }

      setEmployees(Object.values(employeeMap))
      setLoading(false)
    }
    load()
  }, [refreshTick])

  const QUARTERS: Quarter[] = ['q1', 'q2', 'q3', 'q4']

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
          <Users className="text-blue-600" size={24} />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Team Check-ins</h1>
            <p className="text-sm text-gray-500">Review your direct reports' quarterly progress</p>
          </div>
        </div>

        <div className="mb-6 flex gap-2">
          {QUARTERS.map((q) => (
            <button
              key={q}
              onClick={() => setActiveQuarter(q)}
              className={cn(
                'rounded-lg px-4 py-2 text-sm font-medium transition-colors',
                activeQuarter === q
                  ? 'bg-blue-600 text-white'
                  : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
              )}
            >
              {q.toUpperCase()}
            </button>
          ))}
        </div>

        {employees.length === 0 ? (
          <div className="rounded-xl border border-gray-200 bg-white py-16 text-center">
            <p className="text-gray-500">No direct reports found.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {employees.map((emp) => {
              const score = weightedScore(emp.goals, activeQuarter)
              return (
                <div key={emp.id} className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
                  <div className="flex items-center justify-between border-b bg-gray-50 px-5 py-3">
                    <div>
                      <p className="font-semibold text-gray-900">{emp.full_name}</p>
                      <p className="text-xs text-gray-500">{emp.department}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <TrendingUp size={16} className={cn(
                        score >= 80 ? 'text-emerald-500' : score >= 50 ? 'text-amber-500' : 'text-red-400'
                      )} />
                      <span className={cn(
                        'text-sm font-bold',
                        score >= 80 ? 'text-emerald-600' : score >= 50 ? 'text-amber-600' : 'text-red-500'
                      )}>
                        {score.toFixed(1)}% avg score
                      </span>
                    </div>
                  </div>

                  {emp.goals.length === 0 ? (
                    <p className="px-5 py-4 text-sm text-gray-400">No approved goals</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-100">
                        <thead>
                          <tr className="text-xs font-medium uppercase tracking-wide text-gray-500">
                            <th className="px-5 py-3 text-left">Goal</th>
                            <th className="px-5 py-3 text-left">Target</th>
                            <th className="px-5 py-3 text-left">Actual</th>
                            <th className="px-5 py-3 text-left">Score</th>
                            <th className="px-5 py-3 text-left">Status</th>
                            <th className="px-5 py-3 text-left">Comment</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {emp.goals.map((goal) => {
                            const ach = goal.quarterly_achievements.find(
                              (a) => a.quarter === activeQuarter
                            )
                            return (
                              <tr
                                key={goal.id}
                                className={cn('transition-colors', ach ? statusRowColor(ach.status) : 'bg-red-50')}
                              >
                                <td className="px-5 py-3 text-sm font-medium text-gray-900 max-w-xs">
                                  {goal.title}
                                </td>
                                <td className="px-5 py-3 text-sm text-gray-600">
                                  {goal.target}
                                </td>
                                <td className="px-5 py-3 text-sm text-gray-600">
                                  {ach?.actual_achievement ?? '—'}
                                </td>
                                <td className="px-5 py-3 text-sm font-semibold">
                                  {ach ? `${ach.computed_score.toFixed(1)}%` : '—'}
                                </td>
                                <td className="px-5 py-3">
                                  {statusBadge(ach?.status)}
                                </td>
                                <td className="px-5 py-3">
                                  <button
                                    onClick={() =>
                                      setCommentModal({ goalId: goal.id, goalTitle: goal.title })
                                    }
                                    className="flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                                  >
                                    <MessageSquare size={12} />
                                    Add Comment
                                  </button>
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {commentModal && (
        <CommentModal
          open={!!commentModal}
          onClose={() => setCommentModal(null)}
          goalId={commentModal.goalId}
          goalTitle={commentModal.goalTitle}
          quarter={activeQuarter}
          onSuccess={() => setRefreshTick((t) => t + 1)}
        />
      )}
    </div>
  )
}
