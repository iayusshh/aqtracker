import { requireUser } from '@/lib/auth'
import type { AppUser, UserRole } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { cn } from '@/lib/utils'
import {
  Target,
  Users,
  CheckCircle,
  Clock,
  AlertCircle,
  TrendingUp,
  Plus,
  Activity,
  MessageSquare,
} from 'lucide-react'
import { DashboardAnimations } from './dashboard-animations'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface StatCard {
  label: string
  value: string | number
  numericValue?: number
  suffix?: string
  prefix?: string
  icon: React.ElementType
  iconColor: string
  iconBg: string
  borderAccent: string
  href?: string
  isPrimary?: boolean
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

interface SerializableStatCard {
  label: string
  value: string | number
  numericValue?: number
  suffix?: string
  prefix?: string
  iconName: string
  iconColor: string
  iconBg: string
  borderAccent: string
  href?: string
  isPrimary?: boolean
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
    {
      label: 'My Goals',
      value: `${stats.goalCount}/8`,
      numericValue: stats.goalCount,
      suffix: '/8',
      icon: Target,
      iconBg: 'bg-indigo-50',
      iconColor: 'text-indigo-600',
      borderAccent: 'border-l-indigo-500',
      href: '/goals',
      isPrimary: true,
    },
    {
      label: 'Weightage Used',
      value: `${stats.weightageUsed}%`,
      numericValue: stats.weightageUsed,
      suffix: '%',
      icon: TrendingUp,
      iconBg: 'bg-emerald-50',
      iconColor: 'text-emerald-600',
      borderAccent: 'border-l-emerald-500',
    },
    {
      label: 'Approved Goals',
      value: stats.pendingCheckins,
      numericValue: stats.pendingCheckins,
      icon: Clock,
      iconBg: 'bg-amber-50',
      iconColor: 'text-amber-600',
      borderAccent: 'border-l-amber-500',
      href: '/goals/checkin',
    },
    {
      label: 'Completion',
      value: `${stats.completionPct}%`,
      numericValue: stats.completionPct,
      suffix: '%',
      icon: CheckCircle,
      iconBg: 'bg-sky-50',
      iconColor: 'text-sky-600',
      borderAccent: 'border-l-sky-500',
    },
  ]
}

function buildManagerCards(
  stats: Awaited<ReturnType<typeof fetchManagerStats>>
): StatCard[] {
  return [
    {
      label: 'Team Size',
      value: stats.teamSize,
      numericValue: stats.teamSize,
      icon: Users,
      iconBg: 'bg-indigo-50',
      iconColor: 'text-indigo-600',
      borderAccent: 'border-l-indigo-500',
      href: '/manager/checkins',
      isPrimary: true,
    },
    {
      label: 'Pending Approvals',
      value: stats.pendingApprovals,
      numericValue: stats.pendingApprovals,
      icon: CheckCircle,
      iconBg: 'bg-amber-50',
      iconColor: 'text-amber-600',
      borderAccent: 'border-l-amber-500',
      href: '/manager/approvals',
    },
    {
      label: 'Check-ins Due',
      value: stats.checkinsDue,
      numericValue: stats.checkinsDue,
      icon: Clock,
      iconBg: 'bg-rose-50',
      iconColor: 'text-rose-600',
      borderAccent: 'border-l-rose-500',
      href: '/manager/checkins',
    },
    {
      label: 'Team Completion',
      value: `${stats.teamCompletion}%`,
      numericValue: stats.teamCompletion,
      suffix: '%',
      icon: TrendingUp,
      iconBg: 'bg-emerald-50',
      iconColor: 'text-emerald-600',
      borderAccent: 'border-l-emerald-500',
    },
  ]
}

function buildAdminCards(
  stats: Awaited<ReturnType<typeof fetchAdminStats>>
): StatCard[] {
  return [
    {
      label: 'Total Goals',
      value: stats.totalGoals,
      numericValue: stats.totalGoals,
      icon: Target,
      iconBg: 'bg-indigo-50',
      iconColor: 'text-indigo-600',
      borderAccent: 'border-l-indigo-500',
      href: '/goals',
      isPrimary: true,
    },
    {
      label: 'Active Employees',
      value: stats.activeEmployees,
      numericValue: stats.activeEmployees,
      icon: Users,
      iconBg: 'bg-emerald-50',
      iconColor: 'text-emerald-600',
      borderAccent: 'border-l-emerald-500',
    },
    {
      label: 'Completion Rate',
      value: `${stats.completionRate}%`,
      numericValue: stats.completionRate,
      suffix: '%',
      icon: TrendingUp,
      iconBg: 'bg-sky-50',
      iconColor: 'text-sky-600',
      borderAccent: 'border-l-sky-500',
    },
    {
      label: 'Overdue Check-ins',
      value: stats.overdueCheckins,
      numericValue: stats.overdueCheckins,
      icon: AlertCircle,
      iconBg: 'bg-rose-50',
      iconColor: 'text-rose-600',
      borderAccent: 'border-l-rose-500',
    },
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

function getGreeting(fullName: string): { text: string; emoji: string } {
  const hour = new Date().getHours()
  const name = fullName.split(' ')[0]
  if (hour < 12) return { text: `Good morning, ${name}`, emoji: '🌅' }
  if (hour < 18) return { text: `Good afternoon, ${name}`, emoji: '☀️' }
  return { text: `Good evening, ${name}`, emoji: '🌙' }
}

// ---------------------------------------------------------------------------
// Serialization helper — strips non-serializable React.ElementType
// ---------------------------------------------------------------------------

function getIconName(icon: React.ElementType): string {
  return (
    (icon as { displayName?: string; name?: string }).displayName ??
    (icon as { name?: string }).name ??
    'Activity'
  )
}

// ---------------------------------------------------------------------------
// Page (server component)
// ---------------------------------------------------------------------------

export default async function DashboardPage() {
  const user = await requireUser()
  const [cards, activity] = await Promise.all([
    resolveCards(user),
    fetchRecentActivity(user.id, user.role),
  ])
  const quickActions = getQuickActions(user.role)
  const greeting = getGreeting(user.full_name)

  // Compute employee weightage for progress bar
  let weightageUsed = 0
  if (user.role === 'employee') {
    const weightageCard = cards.find((c) => c.label === 'Weightage Used')
    if (weightageCard && weightageCard.numericValue !== undefined) {
      weightageUsed = weightageCard.numericValue
    }
  }

  // Serialize cards — strip the non-serializable icon React component
  const serializableCards: SerializableStatCard[] = cards.map((c) => ({
    label: c.label,
    value: c.value,
    numericValue: c.numericValue,
    suffix: c.suffix,
    prefix: c.prefix,
    iconName: getIconName(c.icon),
    iconColor: c.iconColor,
    iconBg: c.iconBg,
    borderAccent: c.borderAccent,
    href: c.href,
    isPrimary: c.isPrimary,
  }))

  const serializableActivity = activity.map((e) => ({
    id: e.id,
    table_name: e.table_name,
    change_type: e.change_type,
    changed_at: e.changed_at,
    changed_by: e.changed_by,
  }))

  const serializableActions = quickActions.map((a) => ({
    label: a.label,
    href: a.href,
    iconName: getIconName(a.icon),
  }))

  return (
    <div className="px-6 py-8 max-w-6xl mx-auto lg:pt-8 pt-20">

      {/* Page header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
          {greeting.emoji} {greeting.text}
        </h1>
        <p className="text-sm text-slate-500 mt-1 capitalize">
          {user.role} &middot; {user.department}
        </p>

        {/* Goal Setting progress bar — employees only */}
        {user.role === 'employee' && (
          <div className="mt-4 max-w-sm">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-medium text-slate-600">Goal Setting Progress</span>
              <span className={cn('text-xs font-semibold', weightageUsed >= 100 ? 'text-emerald-600' : 'text-indigo-600')}>
                {weightageUsed}% / 100%
              </span>
            </div>
            <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
              <div
                className={cn(
                  'h-full rounded-full transition-all duration-700',
                  weightageUsed >= 100
                    ? 'bg-gradient-to-r from-emerald-500 to-emerald-400'
                    : 'bg-gradient-to-r from-indigo-500 to-violet-500',
                )}
                style={{ width: `${Math.min(weightageUsed, 100)}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Animated stat grid + activity feed + quick actions (client component) */}
      <DashboardAnimations
        cards={serializableCards}
        activity={serializableActivity}
        quickActions={serializableActions}
      />
    </div>
  )
}
