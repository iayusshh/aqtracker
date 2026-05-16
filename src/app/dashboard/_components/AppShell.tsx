import { requireUser } from '@/lib/auth'
import SidebarClient from './SidebarClient'

export default async function AppShell({ children }: { children: React.ReactNode }) {
  const user = await requireUser()
  return (
    <div className="flex h-full bg-slate-50">
      <SidebarClient user={user} />
      <main className="flex-1 min-w-0 overflow-y-auto">
        {children}
      </main>
    </div>
  )
}
