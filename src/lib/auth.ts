import { createClient } from './supabase/server'
import { redirect } from 'next/navigation'

export type UserRole = 'employee' | 'manager' | 'admin'

export interface AppUser {
  id: string
  email: string
  full_name: string
  role: UserRole
  department: string
  manager_id: string | null
}

export async function getUser(): Promise<AppUser | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data } = await supabase
    .from('users')
    .select('*')
    .eq('id', user.id)
    .single()

  return data as AppUser | null
}

export async function requireUser(): Promise<AppUser> {
  const user = await getUser()
  if (!user) redirect('/login')
  return user
}

export async function requireRole(role: UserRole | UserRole[]): Promise<AppUser> {
  const user = await requireUser()
  const roles = Array.isArray(role) ? role : [role]
  if (!roles.includes(user.role)) redirect('/dashboard')
  return user
}
