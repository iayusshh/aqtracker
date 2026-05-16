import { requireUser } from '@/lib/auth'
import type { AppUser, UserRole } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { formatDate, cn } from '@/lib/utils'
import Link from 'next/link'
import {
  Target,
  Users,
  CheckCircle,
  Clock,
  AlertCircle,
  TrendingUp,
  Plus,
  ChevronRight,
  Activity,
  MessageSquare,
} from 'lucide-react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface StatCard {
  label: string
  value: string | number
  icon: React.ElementType
  iconColor: string
  iconBg: string
  href?: string
}

interface AuditEntry {
  id: string
  table_name: string
  change_type: string
  changed_at: string
  changed_by: string
}

interface QuickAction {
  label: string
  href: string
  icon: React.ElementType
}

// ---------------------------------------------------------------------------
// Data fetching
// ---------------------------------------------------------------------------

async function fetchEmployeeStats(userId: string) {
  const supabase = await createClient()
  const { data: goals } = await supabase
    .from('goals').select('id, status, weightage').eq('employee_id', userId)
  const all = goals ?? []
  const totalWeightage = all.reduce((sum, g) => sum + (g.weightage ?? 0), 0)
  const locked = all.filter((g) => g.status === 'locked').length
  const completionPct = all.length > 0 ? Math.round((locked / all.length) * 100) : 0
  return {
    goalCount: all.length,
    weightageUsed: totalWeightage,
    pendingCheckins: all.filter((g) => g.status === 'locked').length,
    completionPct,
  }
}

async function fetchManagerStats(userId: string) {
  const supabase = await createClient()
  const [teamRes, approvalsRes] = await Promise.all([
    supabase.from('users').select('id').eq('manager_id', userId).eq('is_active', true),
    supabase.from('goals').select('id').eq('status', 'submitted'),
  ])
  const teamIds = (teamRes.data ?? []).map((u) => u.id)
  let teamCompletion = 0
  if (teamIds.length > 0) {
    const { data: teamGoals } = await supabase
      .from('goals').select('status').in('employee_id', teamIds)
    const all = teamGoals ?? []
    const locked = all.filter((g) => g.status === 'locked').length
    teamCompletion = all.length > 0 ? Math.round((locked / all.length) * 100) : 0
  }
  return {
    teamSize: teamIds.length,
    pendingApprovals: approvalsRes.data?.length ?? 0,
    checkinsDue: 0,
    teamCompletion,
  }
}

async function fetchAdminStats() {
  const supabase = await createClient()
  const [goalsRes, usersRes] = await Promise.all([
    supabase.from('goals').select('id, status'),
    supabase.from('users').select('id').eq('is_active', true),
  ])
  const goals = goalsRes.data ?? []
  const locked = goals.filter((g) => g.status === 'locked').length
  const completionRate = goals.length > 0 ? Math.round((locked / goals.length) * 100) : 0
  return {
    totalGoals: goals.length,
    activeEmployees: usersRes.data?.length ?? 0,
    completionRate,
    overdueCheckins: 0,
  }
}

async function fetchRecentActivity(userId: string, role: UserRole): Promise<AuditEntry[]> {
  const supabase = await createClient()
  let query = supabase
    .from('audit_log')
    .select('id, table_name, change_type, changed_at, changed_by')
    .order('changed_at', { ascending: false })
    .limit(5)
  if (role === 'employee') {
    query = query.eq('changed_by', userId)
  }
  const { data } = await query
  return (data ?? []) as AuditEntry[]
}

// ---------------------------------------------------------------------------
// Card builders
// ---------------------------------------------------------------------------

function buildEmployeeCards(
  stats: Awaited<ReturnType<typeof fetchEmployeeStats>>
): StatCard[] {
  return [
    { label: 'My Goals', value: `${stats.goalCount}/8`, icon: Target, iconBg: 'bg-indigo-50', iconColor: 'text-indigo-600', href: '/goals' },
    { label: 'Weightage Used', value: `${stats.weightageUsed}%`, icon: TrendingUp, iconBg: 'bg-emerald-50', iconColor: 'text-emerald-600' },
    { label: 'Approved Goals', value: stats.pendingCheckins, icon: Clock, iconBg: 'bg-amber-50', iconColor: 'text-amber-600', href: '/goals/checkin' },
    { label: 'Completion', value: `${stats.completionPct}%`, icon: CheckCircle, iconBg: 'bg-sky-50', iconColor: 'text-sky-600' },
  ]
}

function buildManagerCards(
  stats: Awaited<ReturnType<typeof fetchManagerStats>>
): StatCard[] {
  return [
    { label: 'Team Size', value: stats.teamSize, icon: Users, iconBg: 'bg-indigo-50', iconColor: 'text-indigo-600', href: '/manager/checkins' },
    { label: 'Pending Approvals', value: stats.pendingApprovals, icon: CheckCircle, iconBg: 'bg-amber-50', iconColor: 'text-amber-600', href: '/manager/approvals' },
    { label: 'Check-ins Due', value: stats.checkinsDue, icon: Clock, iconBg: 'bg-rose-50', iconColor: 'text-rose-600', href: '/manager/checkins' },
    { label: 'Team Completion', value: `${stats.teamCompletion}%`, icon: TrendingUp, iconBg: 'bg-emerald-50', iconColor: 'text-emerald-600' },
  ]
}

function buildAdminCards(
  stats: Awaited<ReturnType<typeof fetchAdminStats>>
): StatCard[] {
  return [
    { label: 'Total Goals', value: stats.totalGoals, icon: Target, iconBg: 'bg-indigo-50', iconColor: 'text-indigo-600', href: '/goals' },
    { label: 'Active Employees', value: stats.activeEmployees, icon: Users, iconBg: 'bg-emerald-50', iconColor: 'text-emerald-600' },
    { label: 'Completion Rate', value: `${stats.completionRate}%`, icon: TrendingUp, iconBg: 'bg-sky-50', iconColor: 'text-sky-600' },
    { label: 'Overdue Check-ins', value: stats.overdueCheckins, icon: AlertCircle, iconBg: 'bg-rose-50', iconColor: 'text-rose-600' },
  ]
}

async function resolveCards(user: AppUser): Promise<StatCard[]> {
  if (user.role === 'employee') return buildEmployeeCards(await fetchEmployeeStats(user.id))
  if (user.role === 'manager') return buildManagerCards(await fetchManagerStats(user.id))
  return buildAdminCards(await fetchAdminStats())
}

function getQuickActions(role: UserRole): QuickAction[] {
  if (role === 'employee') {
    return [
      { label: 'Add Goal', href: '/goals/new', icon: Plus },
      { label: 'Submit Check-in', href: '/goals/checkin', icon: MessageSquare },
    ]
  }
  if (role === 'manager') {
    return [
      { label: 'Review Approvals', href: '/manager/approvals', icon: CheckCircle },
      { label: 'Team Check-ins', href: '/manager/checkins', icon: Users },
    ]
  }
  return [
    { label: 'Manage Cycles', href: '/admin/cycles', icon: Plus },
    { label: 'Push Shared Goal', href: '/admin/shared-goals', icon: Users },
    { label: 'Audit Log', href: '/admin/audit-log', icon: Activity },
  ]
}

function getGreeting(fullName: string): string {
  const hour = new Date().getHours()
  const name = fullName.split(' ')[0]
  if (hour < 12) return `Good morning, ${name}`
  if (hour < 18) return `Good afternoon, ${name}`
  return `Good evening, ${name}`
}

// ---------------------------------------------------------------------------
// UI components
// ---------------------------------------------------------------------------

function StatCardUI({ card }: { card: StatCard }) {
  const Icon = card.icon
  const inner = (
    <div className="bg-white border border-slate-200 rounded-xl p-5 flex items-start gap-4 hover:border-slate-300 transition group">
      <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0', card.iconBg)}>
        <Icon className={cn('w-5 h-5', card.iconColor)} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-slate-500 font-medium truncate">{card.label}</p>
        <p className="text-2xl font-bold text-slate-900 mt-0.5 tabular-nums">{card.value}</p>
      </div>
      {card.href && (
        <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-slate-500 flex-shrink-0 self-center transition" />
      )}
    </div>
  )
  return card.href ? <Link href={card.href}>{inner}</Link> : inner
}

const CHANGE_TYPE_LABEL: Record<string, string> = {
  insert: 'Created',
  update: 'Updated',
  delete: 'Deleted',
}

const TABLE_LABEL: Record<string, string> = {
  goals: 'a goal',
  manager_checkins: 'a check-in',
  users: 'a user record',
  goal_cycles: 'a cycle',
  audit_logs: 'an audit entry',
}

function ActivityFeed({ entries }: { entries: AuditEntry[] }) {
  if (entries.length === 0) {
    return <p className="text-sm text-slate-400 py-2">No recent activity to show.</p>
  }
  return (
    <ul className="space-y-3">
      {entries.map((entry) => (
        <li key={entry.id} className="flex items-start gap-3">
          <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0 mt-0.5">
            <Activity className="w-3.5 h-3.5 text-slate-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm text-slate-700">
              <span className="font-medium">{CHANGE_TYPE_LABEL[entry.change_type] ?? entry.change_type}</span>
              {' '}
              <span className="text-slate-500">{TABLE_LABEL[entry.table_name] ?? entry.table_name}</span>
            </p>
            <p className="text-xs text-slate-400 mt-0.5">{formatDate(entry.changed_at)}</p>
          </div>
        </li>
      ))}
    </ul>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function DashboardPage() {
  const user = await requireUser()
  const [cards, activity] = await Promise.all([
    resolveCards(user),
    fetchRecentActivity(user.id, user.role),
  ])
  const quickActions = getQuickActions(user.role)

  return (
    <div className="px-6 py-8 max-w-6xl mx-auto lg:pt-8 pt-20">

      {/* Page header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">{getGreeting(user.full_name)}</h1>
        <p className="text-sm text-slate-500 mt-1 capitalize">{user.role} &middot; {user.department}</p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
        {cards.map((card) => (
          <StatCardUI key={card.label} card={card} />
        ))}
      </div>

      {/* Bottom row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Activity feed */}
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl p-6">
          <h2 className="text-sm font-semibold text-slate-900 mb-5 flex items-center gap-2">
            <Activity className="w-4 h-4 text-slate-400" />
            Recent Activity
          </h2>
          <ActivityFeed entries={activity} />
        </div>

        {/* Quick actions */}
        <div className="bg-white border border-slate-200 rounded-xl p-6">
          <h2 className="text-sm font-semibold text-slate-900 mb-4">Quick Actions</h2>
          <div className="space-y-2">
            {quickActions.map((action) => {
              const Icon = action.icon
              return (
                <Link
                  key={action.href}
                  href={action.href}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-slate-200 hover:border-indigo-200 hover:bg-indigo-50 transition group text-sm font-medium text-slate-700 hover:text-indigo-700"
                >
                  <Icon className="w-4 h-4 text-slate-400 group-hover:text-indigo-500" />
                  <span className="flex-1">{action.label}</span>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-indigo-400" />
                </Link>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
