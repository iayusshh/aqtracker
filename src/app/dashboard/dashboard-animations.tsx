'use client'

import { motion } from 'framer-motion'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { NumberTicker } from '@/components/ui/number-ticker'
import { BorderBeam } from '@/components/ui/border-beam'
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
  ArrowRight,
} from 'lucide-react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

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

interface SerializableAuditEntry {
  id: string
  table_name: string
  change_type: string
  changed_at: string
  changed_by: string
}

interface SerializableQuickAction {
  label: string
  href: string
  iconName: string
}

// ---------------------------------------------------------------------------
// Icon map
// ---------------------------------------------------------------------------

const ICON_MAP: Record<string, React.ElementType> = {
  Target,
  Users,
  CheckCircle,
  Clock,
  AlertCircle,
  TrendingUp,
  Plus,
  Activity,
  MessageSquare,
  ChevronRight,
  ArrowRight,
}

function IconByName({ name, className }: { name: string; className?: string }) {
  const Icon = ICON_MAP[name] ?? Activity
  return <Icon className={className} />
}

// ---------------------------------------------------------------------------
// Labels
// ---------------------------------------------------------------------------

const CHANGE_TYPE_DOT: Record<string, string> = {
  insert: 'bg-emerald-500',
  update: 'bg-blue-500',
  delete: 'bg-red-500',
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
  audit_log: 'an audit entry',
}

function formatDate(date: string) {
  return new Date(date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

// ---------------------------------------------------------------------------
// Animated stat card
// ---------------------------------------------------------------------------

function AnimatedStatCard({ card, index }: { card: SerializableStatCard; index: number }) {
  const inner = (
    <div
      className={cn(
        'relative bg-white border border-slate-200 border-l-4 rounded-xl p-5 flex items-start gap-4',
        'hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 group cursor-pointer',
        card.borderAccent,
        card.isPrimary && 'overflow-hidden',
      )}
    >
      {card.isPrimary && (
        <BorderBeam size={180} duration={10} colorFrom="#6366f1" colorTo="#8b5cf6" />
      )}
      <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0', card.iconBg)}>
        <IconByName name={card.iconName} className={cn('w-5 h-5', card.iconColor)} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-slate-500 font-medium truncate">{card.label}</p>
        <p className="text-2xl font-bold text-slate-900 mt-0.5 tabular-nums">
          {card.numericValue !== undefined ? (
            <NumberTicker
              value={card.numericValue}
              delay={index * 0.08}
              suffix={card.suffix ?? ''}
              prefix={card.prefix ?? ''}
              className="text-2xl font-bold text-slate-900"
            />
          ) : (
            card.value
          )}
        </p>
      </div>
      {card.href && (
        <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-slate-500 flex-shrink-0 self-center transition" />
      )}
    </div>
  )

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: 'easeOut', delay: index * 0.08 }}
    >
      {card.href ? <Link href={card.href}>{inner}</Link> : inner}
    </motion.div>
  )
}

// ---------------------------------------------------------------------------
// Animated activity item
// ---------------------------------------------------------------------------

function AnimatedActivityItem({
  entry,
  index,
}: {
  entry: SerializableAuditEntry
  index: number
}) {
  const dotColor = CHANGE_TYPE_DOT[entry.change_type] ?? 'bg-slate-400'

  return (
    <motion.li
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut', delay: index * 0.07 }}
      className="flex items-start gap-3"
    >
      <div className="flex items-center justify-center w-7 h-7 flex-shrink-0 mt-0.5">
        <span className={cn('w-2 h-2 rounded-full flex-shrink-0', dotColor)} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-slate-700">
          <span className="font-medium">{CHANGE_TYPE_LABEL[entry.change_type] ?? entry.change_type}</span>
          {' '}
          <span className="text-slate-500">{TABLE_LABEL[entry.table_name] ?? entry.table_name}</span>
        </p>
        <p className="text-xs text-slate-400 mt-0.5">{formatDate(entry.changed_at)}</p>
      </div>
    </motion.li>
  )
}

// ---------------------------------------------------------------------------
// Animated quick action
// ---------------------------------------------------------------------------

function AnimatedQuickAction({
  action,
  index,
}: {
  action: SerializableQuickAction
  index: number
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut', delay: 0.3 + index * 0.06 }}
    >
      <Link
        href={action.href}
        className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-slate-200 hover:border-indigo-200 hover:bg-indigo-50 transition-all duration-150 group text-sm font-medium text-slate-700 hover:text-indigo-700"
      >
        <IconByName name={action.iconName} className="w-4 h-4 text-slate-400 group-hover:text-indigo-500 flex-shrink-0 transition-colors" />
        <span className="flex-1">{action.label}</span>
        <ArrowRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-indigo-400 group-hover:translate-x-1 transition-all duration-200" />
      </Link>
    </motion.div>
  )
}

// ---------------------------------------------------------------------------
// Main export — all animated dashboard sections
// ---------------------------------------------------------------------------

export function DashboardAnimations({
  cards,
  activity,
  quickActions,
}: {
  cards: SerializableStatCard[]
  activity: SerializableAuditEntry[]
  quickActions: SerializableQuickAction[]
}) {
  return (
    <>
      {/* Stats grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
        {cards.map((card, i) => (
          <AnimatedStatCard key={card.label} card={card} index={i} />
        ))}
      </div>

      {/* Bottom row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Activity feed */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: 'easeOut', delay: 0.2 }}
          className="lg:col-span-2 bg-white border border-slate-200 rounded-xl p-6"
        >
          <h2 className="text-sm font-semibold text-slate-900 mb-5 flex items-center gap-2">
            <Activity className="w-4 h-4 text-slate-400" />
            Recent Activity
          </h2>
          {activity.length === 0 ? (
            <p className="text-sm text-slate-400 py-2">No recent activity to show.</p>
          ) : (
            <ul className="space-y-3">
              {activity.map((entry, i) => (
                <AnimatedActivityItem key={entry.id} entry={entry} index={i} />
              ))}
            </ul>
          )}
        </motion.div>

        {/* Quick actions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: 'easeOut', delay: 0.25 }}
          className="bg-white border border-slate-200 rounded-xl p-6"
        >
          <h2 className="text-sm font-semibold text-slate-900 mb-4">Quick Actions</h2>
          <div className="space-y-2">
            {quickActions.map((action, i) => (
              <AnimatedQuickAction key={action.href} action={action} index={i} />
            ))}
          </div>
        </motion.div>
      </div>
    </>
  )
}
