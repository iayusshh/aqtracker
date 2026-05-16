import { requireUser } from '@/lib/auth'
import type { AppUser, UserRole } from '@/lib/auth'
import SidebarClient from './_components/SidebarClient'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser()

  return (
    <div className="flex h-full bg-slate-50">
      <SidebarClient user={user} />
      {/*
        flex-1 + min-w-0 prevents content overflow in flex context.
        lg:pt-0 resets the mobile topbar offset (SidebarClient adds pt-20 on the page itself).
      */}
      <main className="flex-1 min-w-0 overflow-y-auto">
        {children}
      </main>
    </div>
  )
}

export type { AppUser, UserRole }
