/**
 * Seed script — creates demo users (employee/manager/admin) via Supabase Admin API.
 * Run: npx tsx scripts/seed.ts
 *
 * Requires SUPABASE_SERVICE_ROLE_KEY and NEXT_PUBLIC_SUPABASE_URL in .env.local
 */
import { config } from 'dotenv'
config({ path: '.env.local' })

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const DEMO_PASSWORD = 'Demo@1234'

async function createUser(
  email: string,
  fullName: string,
  role: 'employee' | 'manager' | 'admin',
  department: string,
  managerId?: string
) {
  const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
    email,
    password: DEMO_PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  })

  if (authError) {
    if (authError.message.includes('already been registered')) {
      console.log(`  ⚠  ${email} already exists, skipping auth creation`)
      const { data } = await supabase.from('users').select('id').eq('email', email).single()
      return data?.id
    }
    throw authError
  }

  const userId = authUser.user.id

  // Upsert into public.users (trigger may have already created a row)
  const { error: profileError } = await supabase.from('users').upsert({
    id: userId,
    email,
    full_name: fullName,
    role,
    department,
    manager_id: managerId ?? null,
    is_active: true,
  })

  if (profileError) throw profileError

  console.log(`  ✓  ${role.padEnd(8)} ${email}`)
  return userId
}

async function seed() {
  console.log('\n🌱 Seeding demo users...\n')

  // Admin
  const adminId = await createUser(
    'admin@demo.com',
    'Admin User',
    'admin',
    'HR'
  )

  // Manager
  const managerId = await createUser(
    'manager@demo.com',
    'Manager User',
    'manager',
    'Engineering',
    adminId
  )

  // Employee
  await createUser(
    'employee@demo.com',
    'Employee User',
    'employee',
    'Engineering',
    managerId
  )

  // Resolve admin ID from users table in case auth already existed
  const { data: adminRow } = await supabase.from('users').select('id').eq('email', 'admin@demo.com').single()
  const resolvedAdminId = adminId ?? adminRow?.id

  // Seed an active cycle
  console.log('\n📅 Seeding active goal cycle...')
  const { error: cycleError } = await supabase.from('goal_cycles').upsert({
    name: 'FY 2025-26',
    year: 2025,
    phase: 'goal_setting',
    window_open: '2025-05-01',
    window_close: '2025-06-30',
    status: 'active',
    created_by: resolvedAdminId,
  })

  if (cycleError) console.error('  ⚠  Cycle seed error:', cycleError.message)
  else console.log('  ✓  FY 2025-26 goal_setting cycle created')

  console.log('\n✅ Seed complete!\n')
  console.log('Demo credentials:')
  console.log('  employee@demo.com / Demo@1234  (role: employee)')
  console.log('  manager@demo.com  / Demo@1234  (role: manager)')
  console.log('  admin@demo.com    / Demo@1234  (role: admin)\n')
}

seed().catch(console.error)
