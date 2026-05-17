import { cache } from 'react'
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

// Cross-request profile cache: Vercel Fluid Compute keeps instances warm across
// requests so this Map survives. Saves the DB round-trip on every page after
// the first hit per user per instance. TTL 60s.
const _profileCache = new Map<string, { profile: AppUser | null; expiry: number }>()

// cache() deduplicates the Supabase getUser() network call within a single
// render — if multiple server components call requireUser() they share one call.
const _getAuthUser = cache(async () => {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
})

export async function getUser(): Promise<AppUser | null> {
  const authUser = await _getAuthUser()
  if (!authUser) return null

  const now = Date.now()
  const hit = _profileCache.get(authUser.id)
  if (hit && hit.expiry > now) return hit.profile

  const supabase = await createClient()
  const { data } = await supabase
    .from('users')
    .select('*')
    .eq('id', authUser.id)
    .single()

  const profile = data as AppUser | null
  _profileCache.set(authUser.id, { profile, expiry: now + 60_000 })

  // Bound memory — evict oldest entry above 500 users
  if (_profileCache.size > 500) _profileCache.delete(_profileCache.keys().next().value!)

  return profile
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

// Call this when a user's profile changes so the cache entry is evicted immediately.
export function invalidateUserCache(userId: string) {
  _profileCache.delete(userId)
}
