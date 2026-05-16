import AppShell from '@/app/dashboard/_components/AppShell'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>
}
