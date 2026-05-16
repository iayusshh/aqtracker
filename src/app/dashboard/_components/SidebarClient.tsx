'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Target,
  LayoutDashboard,
  TrendingUp,
  MessageSquare,
  Users,
  CheckCircle,
  FileText,
  Shield,
  Clock,
  Menu,
  X,
  LogOut,
} from 'lucide-react'
import type { AppUser, UserRole } from '@/lib/auth'
import { cn } from '@/lib/utils'

interface NavItem {
  label: string
  href: string
  icon: React.ElementType
  badge?: number
}

function getNavItems(role: UserRole): NavItem[] {
  if (role === 'employee') {
    return [
      { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
      { label: 'My Goals', href: '/goals', icon: Target },
      { label: 'Check-ins', href: '/goals/checkin', icon: MessageSquare },
      { label: 'Achievement Report', href: '/reports/achievement', icon: TrendingUp },
    ]
  }
  if (role === 'manager') {
    return [
      { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
      { label: 'Approvals', href: '/manager/approvals', icon: CheckCircle },
      { label: 'Team Check-ins', href: '/manager/checkins', icon: MessageSquare },
      { label: 'Completion Dashboard', href: '/reports/completion', icon: Users },
      { label: 'Achievement Report', href: '/reports/achievement', icon: FileText },
    ]
  }
  return [
    { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { label: 'All Goals', href: '/goals', icon: Target },
    { label: 'Shared Goals', href: '/admin/shared-goals', icon: Users },
    { label: 'Cycles', href: '/admin/cycles', icon: Clock },
    { label: 'Reports', href: '/reports/achievement', icon: FileText },
    { label: 'Audit Log', href: '/admin/audit-log', icon: Shield },
  ]
}

const ROLE_BADGE_STYLES: Record<UserRole, string> = {
  employee: 'bg-gradient-to-r from-slate-100 to-slate-200 text-slate-600',
  manager: 'bg-gradient-to-r from-indigo-100 to-indigo-200 text-indigo-700',
  admin: 'bg-gradient-to-r from-violet-100 to-violet-200 text-violet-700',
}

const AVATAR_GRADIENT: Record<UserRole, string> = {
  employee: 'bg-gradient-to-br from-slate-500 to-slate-700',
  manager: 'bg-gradient-to-br from-indigo-500 to-indigo-700',
  admin: 'bg-gradient-to-br from-violet-500 to-violet-700',
}

interface Props {
  user: AppUser
}

function NavLink({ item, onClick }: { item: NavItem; onClick?: () => void }) {
  const pathname = usePathname()
  const isActive =
    pathname === item.href ||
    (item.href !== '/dashboard' && pathname.startsWith(item.href))
  const Icon = item.icon

  return (
    <Link
      href={item.href}
      onClick={onClick}
      className={cn(
        'relative flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all duration-150',
        isActive
          ? 'bg-gradient-to-r from-indigo-50 to-violet-50 text-indigo-700 font-medium before:absolute before:left-0 before:top-1 before:bottom-1 before:w-0.5 before:bg-indigo-500 before:rounded-full'
          : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 font-normal'
      )}
    >
      <Icon
        className={cn(
          'w-4 h-4 flex-shrink-0',
          isActive ? 'text-indigo-600' : 'text-slate-400'
        )}
      />
      <span className="flex-1">{item.label}</span>
      {item.badge !== undefined && item.badge > 0 && (
        <span className="ml-auto text-xs font-semibold bg-indigo-600 text-white rounded-full w-5 h-5 flex items-center justify-center">
          {item.badge > 9 ? '9+' : item.badge}
        </span>
      )}
    </Link>
  )
}

function SidebarContent({
  user,
  navItems,
  onClose,
}: {
  user: AppUser
  navItems: NavItem[]
  onClose?: () => void
}) {
  const initials = user.full_name
    .split(' ')
    .slice(0, 2)
    .map((n) => n[0])
    .join('')
    .toUpperCase()

  // Split nav: first item (Dashboard) gets its own group
  const [dashboardItem, ...restItems] = navItems

  return (
    <div className="flex flex-col h-full">
      {/* Logo area */}
      <div className="flex items-center justify-between px-4 h-16 border-b border-slate-200 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-xl flex items-center justify-center shadow-sm">
            <Target className="w-4 h-4 text-white" />
          </div>
          <div className="flex flex-col leading-tight">
            <span className="text-sm font-semibold text-slate-900">AQTracker</span>
            <span className="text-[10px] text-slate-400 uppercase tracking-widest">
              Performance Portal
            </span>
          </div>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 lg:hidden transition-colors"
            aria-label="Close menu"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        {dashboardItem && (
          <NavLink key={dashboardItem.href} item={dashboardItem} onClick={onClose} />
        )}

        {restItems.length > 0 && (
          <>
            <hr className="border-slate-100 mx-3 my-1" />
            {restItems.map((item) => (
              <NavLink key={item.href} item={item} onClick={onClose} />
            ))}
          </>
        )}
      </nav>

      {/* User footer */}
      <div className="border-t border-slate-200 p-3">
        <div className="flex items-center gap-3 px-2 py-2">
          {/* Gradient avatar */}
          <div
            className={cn(
              'w-9 h-9 rounded-full text-white text-xs font-bold flex items-center justify-center flex-shrink-0 shadow-sm',
              AVATAR_GRADIENT[user.role]
            )}
          >
            {initials}
          </div>

          {/* Name + role + department */}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-slate-900 truncate">{user.full_name}</p>
            <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
              <span
                className={cn(
                  'text-xs font-medium px-1.5 py-0.5 rounded-full capitalize',
                  ROLE_BADGE_STYLES[user.role]
                )}
              >
                {user.role}
              </span>
            </div>
            {user.department && (
              <p className="text-xs text-slate-400 mt-0.5 truncate">{user.department}</p>
            )}
          </div>

          {/* Sign out */}
          <form method="POST" action="/auth/logout">
            <button
              type="submit"
              title="Sign out"
              className="text-slate-400 hover:text-slate-600 transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}

export default function SidebarClient({ user }: Props) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const navItems = getNavItems(user.role)

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex flex-col w-60 bg-white border-r border-slate-200/80 shadow-sm flex-shrink-0 h-full">
        <SidebarContent user={user} navItems={navItems} />
      </aside>

      {/* Mobile topbar */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-40 h-14 bg-white border-b border-slate-200 flex items-center px-4 gap-3 shadow-sm">
        <button
          onClick={() => setMobileOpen(true)}
          className="text-slate-500 hover:text-slate-700 transition-colors"
          aria-label="Open menu"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-lg flex items-center justify-center">
            <Target className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="text-sm font-semibold text-slate-900">AQTracker</span>
        </div>
      </div>

      {/* Mobile drawer */}
      <AnimatePresence>
        {mobileOpen && (
          <div className="lg:hidden fixed inset-0 z-50 flex">
            {/* Backdrop */}
            <motion.div
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setMobileOpen(false)}
            />

            {/* Drawer */}
            <motion.aside
              className="relative w-64 bg-white h-full shadow-xl flex flex-col"
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
            >
              <SidebarContent
                user={user}
                navItems={navItems}
                onClose={() => setMobileOpen(false)}
              />
            </motion.aside>
          </div>
        )}
      </AnimatePresence>
    </>
  )
}
