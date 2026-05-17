/**
 * Full realistic demo seed for AtomQuest Goal Tracker
 * Company: AtomQuest Technologies (Engineering + Sales departments)
 * Run: npx tsx scripts/seed-demo.ts
 */
import { config } from 'dotenv'
config({ path: '.env.local' })

import { createClient } from '@supabase/supabase-js'

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const PASSWORD = 'Demo@1234'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function upsertUser(
  email: string,
  fullName: string,
  role: 'employee' | 'manager' | 'admin',
  department: string,
  managerId?: string
): Promise<string> {
  const existing = await sb.from('users').select('id').eq('email', email).maybeSingle()
  if (existing.data?.id) {
    await sb.from('users').update({ full_name: fullName, role, department, manager_id: managerId ?? null }).eq('id', existing.data.id)
    console.log(`  [updated] ${role.padEnd(8)} ${email}`)
    return existing.data.id
  }

  const { data, error } = await sb.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  })
  if (error) throw new Error(`createUser ${email}: ${error.message}`)

  const id = data.user.id
  await sb.from('users').upsert({ id, email, full_name: fullName, role, department, manager_id: managerId ?? null, is_active: true })
  console.log(`  [ok] ${role.padEnd(8)} ${email}`)
  return id
}

async function upsertCycle(
  name: string,
  year: number,
  phase: string,
  windowOpen: string,
  windowClose: string,
  status: string,
  createdBy: string
): Promise<string> {
  const { data: existing } = await sb.from('goal_cycles').select('id').eq('name', name).eq('phase', phase).maybeSingle()
  if (existing?.id) {
    await sb.from('goal_cycles').update({ status, window_open: windowOpen, window_close: windowClose }).eq('id', existing.id)
    console.log(`  [updated] Cycle "${name}" (${phase})`)
    return existing.id
  }

  const { data, error } = await sb.from('goal_cycles').insert({
    name, year, phase, window_open: windowOpen, window_close: windowClose, status, created_by: createdBy,
  }).select('id').single()
  if (error) throw new Error(`upsertCycle ${name}: ${error.message}`)
  console.log(`  [ok] Cycle "${name}" (${phase})`)
  return data.id
}

async function insertGoal(g: {
  employeeId: string
  cycleId: string
  thrustArea: string
  title: string
  description: string
  uomType: string
  target: string
  weightage: number
  status: string
  isShared?: boolean
}): Promise<string> {
  const { data, error } = await sb.from('goals').insert({
    employee_id: g.employeeId,
    cycle_id: g.cycleId,
    thrust_area: g.thrustArea,
    title: g.title,
    description: g.description,
    uom_type: g.uomType,
    target: g.target,
    weightage: g.weightage,
    status: g.status,
    is_shared: g.isShared ?? false,
  }).select('id').single()
  if (error) throw new Error(`insertGoal "${g.title}": ${error.message}`)
  return data.id
}

async function insertAchievement(a: {
  goalId: string
  quarter: string
  actualAchievement: string
  status: string
  computedScore: number
}): Promise<void> {
  const { error } = await sb.from('quarterly_achievements').upsert({
    goal_id: a.goalId,
    quarter: a.quarter,
    actual_achievement: a.actualAchievement,
    status: a.status,
    computed_score: a.computedScore,
    submitted_at: new Date().toISOString(),
  }, { onConflict: 'goal_id,quarter' })
  if (error) throw new Error(`insertAchievement goal=${a.goalId}: ${error.message}`)
}

async function insertManagerCheckin(c: {
  goalId: string
  managerId: string
  quarter: string
  comment: string
}): Promise<void> {
  const { error } = await sb.from('manager_checkins').insert({
    goal_id: c.goalId,
    manager_id: c.managerId,
    quarter: c.quarter,
    comment: c.comment,
  })
  if (error) throw new Error(`insertManagerCheckin: ${error.message}`)
}

async function insertAudit(a: {
  tableName: string
  recordId: string
  changedBy: string
  changeType: string
  oldValue?: object | null
  newValue?: object | null
}): Promise<void> {
  await sb.from('audit_log').insert({
    table_name: a.tableName,
    record_id: a.recordId,
    changed_by: a.changedBy,
    change_type: a.changeType,
    old_value: a.oldValue ?? null,
    new_value: a.newValue ?? null,
  })
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function seed() {
  console.log('\nAtomQuest Technologies - Full Demo Seed\n')

  // --- 1. Users ---
  console.log('Creating users...')

  const adminId  = await upsertUser('admin@aqtech.io',   'Ananya Krishnan', 'admin',    'People & Culture')
  const vikramId = await upsertUser('vikram@aqtech.io',  'Vikram Mehta',    'manager',  'Engineering', adminId)
  const deepaId  = await upsertUser('deepa@aqtech.io',   'Deepa Nair',      'manager',  'Sales',       adminId)
  const arjunId  = await upsertUser('arjun@aqtech.io',   'Arjun Sharma',    'employee', 'Engineering', vikramId)
  const snehaId  = await upsertUser('sneha@aqtech.io',   'Sneha Gupta',     'employee', 'Engineering', vikramId)
  const rahulId  = await upsertUser('rahul@aqtech.io',   'Rahul Khanna',    'employee', 'Sales',       deepaId)
  const meeraId  = await upsertUser('meera@aqtech.io',   'Meera Joshi',     'employee', 'Sales',       deepaId)

  // Keep existing baseline demo accounts
  await upsertUser('admin@demo.com',    'Admin User',    'admin',    'HR')
  await upsertUser('manager@demo.com',  'Manager User',  'manager',  'Engineering', adminId)
  await upsertUser('employee@demo.com', 'Employee User', 'employee', 'Engineering', vikramId)

  // --- 2. Cycles ---
  console.log('\nCreating goal cycles...')

  const cycleGoalSettingId = await upsertCycle(
    'FY 2025-26 Goal Setting', 2025, 'goal_setting',
    '2026-05-01', '2026-06-30', 'active', adminId
  )
  await upsertCycle('FY 2025-26 Q1 Review', 2025, 'q1', '2026-07-01', '2026-09-30', 'draft', adminId)
  await upsertCycle('FY 2025-26 Q2 Review', 2025, 'q2', '2026-10-01', '2026-12-31', 'draft', adminId)

  // --- 3. Goals: Arjun Sharma (Engineering, fully locked) ---
  console.log('\nCreating goals for Arjun Sharma...')

  const g_arjun_api = await insertGoal({
    employeeId: arjunId, cycleId: cycleGoalSettingId,
    thrustArea: 'Technology & Innovation',
    title: 'Reduce API p95 latency from 800ms to under 200ms',
    description: 'Optimise slow database queries, introduce Redis caching layer, and profile with Datadog APM to cut tail latency across all critical endpoints.',
    uomType: 'min_numeric', target: '200', weightage: 25, status: 'locked',
  })
  const g_arjun_tests = await insertGoal({
    employeeId: arjunId, cycleId: cycleGoalSettingId,
    thrustArea: 'Quality & Reliability',
    title: 'Achieve 90%+ unit test coverage across core modules',
    description: 'Write missing tests for auth, payments, and notifications modules. Set coverage gate in CI to block merges below 90%.',
    uomType: 'min_percent', target: '90', weightage: 20, status: 'locked',
  })
  const g_arjun_payment = await insertGoal({
    employeeId: arjunId, cycleId: cycleGoalSettingId,
    thrustArea: 'Product Delivery',
    title: 'Ship Payment Gateway v2.0 by September 30, 2026',
    description: 'Deliver multi-currency support, UPI AutoPay, and fraud detection integration. Launch to 100% traffic by Sep 30.',
    uomType: 'timeline', target: '2026-09-30', weightage: 25, status: 'locked',
  })
  const g_arjun_cert = await insertGoal({
    employeeId: arjunId, cycleId: cycleGoalSettingId,
    thrustArea: 'Learning & Development',
    title: 'Earn AWS Solutions Architect Professional certification',
    description: 'Complete AWS SAP-C02 exam by August 2026. Expense to be claimed via L&D budget.',
    uomType: 'zero', target: 'N/A', weightage: 15, status: 'locked',
  })
  const g_arjun_mentor = await insertGoal({
    employeeId: arjunId, cycleId: cycleGoalSettingId,
    thrustArea: 'People Development',
    title: 'Mentor 2 junior engineers to mid-level readiness',
    description: 'Conduct weekly 1:1s, pair-program on complex tickets, and co-author growth plans for Rohan and Divya.',
    uomType: 'min_numeric', target: '2', weightage: 15, status: 'locked',
  })

  // --- 4. Goals: Sneha Gupta (Engineering, mixed statuses) ---
  console.log('Creating goals for Sneha Gupta...')

  const g_sneha_mobile = await insertGoal({
    employeeId: snehaId, cycleId: cycleGoalSettingId,
    thrustArea: 'Product Delivery',
    title: 'Redesign mobile checkout - reduce cart abandonment by 30%',
    description: 'Implement one-tap checkout, guest purchase flow, and address autocomplete. Measure via GA4 funnel events.',
    uomType: 'min_percent', target: '30', weightage: 30, status: 'submitted',
  })
  const g_sneha_tests = await insertGoal({
    employeeId: snehaId, cycleId: cycleGoalSettingId,
    thrustArea: 'Quality & Reliability',
    title: 'Achieve 85% unit test coverage on mobile codebase',
    description: 'Current coverage is 52%. Write tests for cart, checkout, and account screens.',
    uomType: 'min_percent', target: '85', weightage: 25, status: 'locked',
  })
  const g_sneha_cert = await insertGoal({
    employeeId: snehaId, cycleId: cycleGoalSettingId,
    thrustArea: 'Learning & Development',
    title: 'Complete React Native Advanced Workshop and internal knowledge share',
    description: 'Attend the 3-day workshop in August and conduct an internal tech talk within 2 weeks.',
    uomType: 'zero', target: 'N/A', weightage: 20, status: 'returned',
  })
  await insertGoal({
    employeeId: snehaId, cycleId: cycleGoalSettingId,
    thrustArea: 'Quality & Reliability',
    title: 'Clear 50 open bug tickets from the mobile backlog',
    description: 'Triage and resolve P2/P3 bugs tagged "mobile" in Jira. Target: 50 tickets closed by Jun 30.',
    uomType: 'min_numeric', target: '50', weightage: 25, status: 'draft',
  })

  // --- 5. Goals: Rahul Khanna (Sales, fully locked) ---
  console.log('Creating goals for Rahul Khanna...')

  const g_rahul_revenue = await insertGoal({
    employeeId: rahulId, cycleId: cycleGoalSettingId,
    thrustArea: 'Revenue Growth',
    title: 'Achieve Rs. 2 Cr new business revenue in FY 2025-26',
    description: 'Focus on mid-market SaaS companies in BFSI and Retail verticals. Target ARR >= Rs. 50L per deal.',
    uomType: 'min_numeric', target: '20000000', weightage: 35, status: 'locked',
  })
  const g_rahul_clients = await insertGoal({
    employeeId: rahulId, cycleId: cycleGoalSettingId,
    thrustArea: 'Revenue Growth',
    title: 'Onboard 12 new enterprise clients',
    description: 'Full sales cycle: discovery, demo, proposal, close. At least 4 clients per quarter.',
    uomType: 'min_numeric', target: '12', weightage: 30, status: 'locked',
  })
  const g_rahul_csat = await insertGoal({
    employeeId: rahulId, cycleId: cycleGoalSettingId,
    thrustArea: 'Customer Success',
    title: 'Maintain CSAT score of 4.5 / 5 or above across all accounts',
    description: 'Run monthly NPS surveys on active accounts. Escalate detractors within 24h.',
    uomType: 'min_numeric', target: '4.5', weightage: 20, status: 'locked',
  })
  const g_rahul_cert = await insertGoal({
    employeeId: rahulId, cycleId: cycleGoalSettingId,
    thrustArea: 'Learning & Development',
    title: 'Complete Salesforce Sales Cloud Consultant certification',
    description: 'Pass SP-CRT exam by Q2 to improve CRM utilisation and pipeline hygiene.',
    uomType: 'zero', target: 'N/A', weightage: 15, status: 'submitted',
  })

  // --- 6. Goals: Meera Joshi (Sales, mixed) ---
  console.log('Creating goals for Meera Joshi...')

  const g_meera_revenue = await insertGoal({
    employeeId: meeraId, cycleId: cycleGoalSettingId,
    thrustArea: 'Revenue Growth',
    title: 'Close Rs. 1.2 Cr in new SMB accounts',
    description: 'Target companies with 50-200 employees in EdTech and HealthTech. Min deal size Rs. 8L ARR.',
    uomType: 'min_numeric', target: '12000000', weightage: 40, status: 'locked',
  })
  const g_meera_clients = await insertGoal({
    employeeId: meeraId, cycleId: cycleGoalSettingId,
    thrustArea: 'Revenue Growth',
    title: 'Acquire 15 new SMB clients',
    description: 'Close at least 15 new logos across Q1-Q3. All deals to be logged in Salesforce within 24h of signing.',
    uomType: 'min_numeric', target: '15', weightage: 35, status: 'locked',
  })
  await insertGoal({
    employeeId: meeraId, cycleId: cycleGoalSettingId,
    thrustArea: 'Customer Success',
    title: 'Upsell existing portfolio by 20% in ARR',
    description: 'Identify expansion opportunities in current 18 accounts. Present quarterly business reviews with upgrade proposals.',
    uomType: 'min_percent', target: '20', weightage: 25, status: 'draft',
  })

  // --- 7. Audit trail ---
  console.log('\nSeeding audit trail...')

  for (const [gId, gTitle] of [
    [g_arjun_api, 'Reduce API p95 latency'],
    [g_arjun_tests, 'Achieve 90%+ unit test coverage'],
    [g_arjun_payment, 'Ship Payment Gateway v2.0'],
    [g_arjun_cert, 'Earn AWS Solutions Architect Professional'],
    [g_arjun_mentor, 'Mentor 2 junior engineers'],
  ]) {
    await insertAudit({ tableName: 'goals', recordId: gId as string, changedBy: arjunId, changeType: 'insert', newValue: { title: gTitle, status: 'draft' } })
    await insertAudit({ tableName: 'goals', recordId: gId as string, changedBy: arjunId, changeType: 'update', oldValue: { status: 'draft' }, newValue: { status: 'submitted' } })
    await insertAudit({ tableName: 'goals', recordId: gId as string, changedBy: vikramId, changeType: 'update', oldValue: { status: 'submitted' }, newValue: { status: 'locked' } })
  }

  await insertAudit({ tableName: 'goals', recordId: g_sneha_cert, changedBy: snehaId, changeType: 'insert', newValue: { title: 'React Native Advanced Workshop', status: 'draft' } })
  await insertAudit({ tableName: 'goals', recordId: g_sneha_cert, changedBy: snehaId, changeType: 'update', oldValue: { status: 'draft' }, newValue: { status: 'submitted' } })
  await insertAudit({
    tableName: 'goals', recordId: g_sneha_cert, changedBy: vikramId, changeType: 'update',
    oldValue: { status: 'submitted' },
    newValue: { status: 'returned', comment: 'Please clarify which specific workshop you are attending and attach the course syllabus. Also confirm the knowledge-share session is scheduled within the quarter.' },
  })
  await insertAudit({ tableName: 'goals', recordId: g_sneha_mobile, changedBy: snehaId, changeType: 'insert', newValue: { title: 'Redesign mobile checkout', status: 'draft' } })
  await insertAudit({ tableName: 'goals', recordId: g_sneha_mobile, changedBy: snehaId, changeType: 'update', oldValue: { status: 'draft' }, newValue: { status: 'submitted' } })
  await insertAudit({ tableName: 'goals', recordId: g_sneha_tests, changedBy: snehaId, changeType: 'insert', newValue: { status: 'draft' } })
  await insertAudit({ tableName: 'goals', recordId: g_sneha_tests, changedBy: snehaId, changeType: 'update', oldValue: { status: 'draft' }, newValue: { status: 'submitted' } })
  await insertAudit({ tableName: 'goals', recordId: g_sneha_tests, changedBy: vikramId, changeType: 'update', oldValue: { status: 'submitted' }, newValue: { status: 'locked' } })

  for (const [gId, gTitle] of [
    [g_rahul_revenue, 'Achieve Rs. 2 Cr new business revenue'],
    [g_rahul_clients, 'Onboard 12 new enterprise clients'],
    [g_rahul_csat, 'Maintain CSAT score 4.5/5'],
  ]) {
    await insertAudit({ tableName: 'goals', recordId: gId as string, changedBy: rahulId, changeType: 'insert', newValue: { title: gTitle, status: 'draft' } })
    await insertAudit({ tableName: 'goals', recordId: gId as string, changedBy: rahulId, changeType: 'update', oldValue: { status: 'draft' }, newValue: { status: 'submitted' } })
    await insertAudit({ tableName: 'goals', recordId: gId as string, changedBy: deepaId, changeType: 'update', oldValue: { status: 'submitted' }, newValue: { status: 'locked' } })
  }
  await insertAudit({ tableName: 'goals', recordId: g_rahul_cert, changedBy: rahulId, changeType: 'insert', newValue: { status: 'draft' } })
  await insertAudit({ tableName: 'goals', recordId: g_rahul_cert, changedBy: rahulId, changeType: 'update', oldValue: { status: 'draft' }, newValue: { status: 'submitted' } })

  for (const [gId, gTitle] of [
    [g_meera_revenue, 'Close Rs. 1.2 Cr in new SMB accounts'],
    [g_meera_clients, 'Acquire 15 new SMB clients'],
  ]) {
    await insertAudit({ tableName: 'goals', recordId: gId as string, changedBy: meeraId, changeType: 'insert', newValue: { title: gTitle, status: 'draft' } })
    await insertAudit({ tableName: 'goals', recordId: gId as string, changedBy: meeraId, changeType: 'update', oldValue: { status: 'draft' }, newValue: { status: 'submitted' } })
    await insertAudit({ tableName: 'goals', recordId: gId as string, changedBy: deepaId, changeType: 'update', oldValue: { status: 'submitted' }, newValue: { status: 'locked' } })
  }

  // --- 8. Q1 achievements (seeded directly, bypasses window check) ---
  console.log('\nSeeding Q1 quarterly achievements...')

  await insertAchievement({ goalId: g_arjun_api,     quarter: 'q1', actualAchievement: '165',        status: 'completed', computedScore: 82.5  })
  await insertAchievement({ goalId: g_arjun_tests,   quarter: 'q1', actualAchievement: '88',         status: 'on_track',  computedScore: 97.8  })
  await insertAchievement({ goalId: g_arjun_payment, quarter: 'q1', actualAchievement: '2026-09-28', status: 'on_track',  computedScore: 100   })
  await insertAchievement({ goalId: g_arjun_cert,    quarter: 'q1', actualAchievement: 'Completed',  status: 'completed', computedScore: 100   })
  await insertAchievement({ goalId: g_arjun_mentor,  quarter: 'q1', actualAchievement: '2',          status: 'completed', computedScore: 100   })
  await insertAchievement({ goalId: g_sneha_tests,   quarter: 'q1', actualAchievement: '71',         status: 'on_track',  computedScore: 83.5  })
  await insertAchievement({ goalId: g_rahul_revenue, quarter: 'q1', actualAchievement: '18750000',   status: 'on_track',  computedScore: 93.75 })
  await insertAchievement({ goalId: g_rahul_clients, quarter: 'q1', actualAchievement: '10',         status: 'on_track',  computedScore: 83.3  })
  await insertAchievement({ goalId: g_rahul_csat,    quarter: 'q1', actualAchievement: '4.7',        status: 'completed', computedScore: 104.4 })
  await insertAchievement({ goalId: g_meera_revenue, quarter: 'q1', actualAchievement: '9200000',    status: 'on_track',  computedScore: 76.7  })
  await insertAchievement({ goalId: g_meera_clients, quarter: 'q1', actualAchievement: '11',         status: 'on_track',  computedScore: 73.3  })

  console.log('  [ok] Q1 achievements created')

  // --- 9. Manager check-in comments ---
  console.log('\nSeeding manager check-in comments...')

  await insertManagerCheckin({
    goalId: g_arjun_api, managerId: vikramId, quarter: 'q1',
    comment: 'Outstanding work Arjun - you brought latency down to 165ms, well below the 200ms target. The Redis cache layer is already showing impact. Keep tracking Datadog p99 spikes on the checkout endpoint.',
  })
  await insertManagerCheckin({
    goalId: g_arjun_tests, managerId: vikramId, quarter: 'q1',
    comment: 'Good progress from 52% to 88%. We are close to the 90% goal. Focus the remaining coverage on the notifications module which still has zero tests. Target 92% by Q2.',
  })
  await insertManagerCheckin({
    goalId: g_rahul_revenue, managerId: deepaId, quarter: 'q1',
    comment: 'Strong Q1 Rahul - Rs. 1.875 Cr closed against Rs. 2 Cr target is 93.75%. Two large deals are in final negotiation. Close focus on getting both signed before July 31 to stay on track for the annual number.',
  })
  await insertManagerCheckin({
    goalId: g_rahul_clients, managerId: deepaId, quarter: 'q1',
    comment: '10 out of 12 clients onboarded. The 2 remaining are in legal review. Push for signatures by end of July. Pipeline health looks strong with 8 new qualified deals for Q2.',
  })
  await insertManagerCheckin({
    goalId: g_meera_revenue, managerId: deepaId, quarter: 'q1',
    comment: 'Meera, Rs. 92L vs Rs. 1.2 Cr target is behind plan. Identify and accelerate 3 deals that can close in Q2. Weekly check-ins until the pipeline is healthier.',
  })

  console.log('  [ok] Manager comments created')

  // --- 10. Shared goal pushed by admin ---
  console.log('\nSeeding shared goal...')

  const sharedGoalRows = [arjunId, snehaId, rahulId, meeraId].map((empId) => ({
    employee_id: empId,
    cycle_id: cycleGoalSettingId,
    thrust_area: 'Organisational Culture',
    title: 'Complete Unconscious Bias and Inclusive Leadership training',
    description: 'Mandatory L&D initiative for all AtomQuest employees. Complete the 4-hour online course and quiz on LMS by June 30, 2026.',
    uom_type: 'zero',
    target: 'N/A',
    weightage: 10,
    status: 'draft',
    is_shared: true,
  }))

  const { data: sharedGoals, error: sgError } = await sb.from('goals').insert(sharedGoalRows).select('id')
  if (sgError) {
    console.error('  [err] Shared goal error:', sgError.message)
  } else if (sharedGoals) {
    const sourceId = sharedGoals[0].id
    const linkedIds = sharedGoals.slice(1).map((g: { id: string }) => g.id)
    if (linkedIds.length > 0) {
      await sb.from('goals').update({ shared_from_goal_id: sourceId }).in('id', linkedIds)
    }
    await insertAudit({ tableName: 'goals', recordId: sourceId, changedBy: adminId, changeType: 'insert', newValue: { title: 'Shared: Unconscious Bias training', is_shared: true } })
    console.log('  [ok] Shared goal pushed to 4 employees')
  }

  // --- Summary ---
  console.log('\nSeed complete.\n')
  console.log('-------------------------------------------')
  console.log('  DEMO CREDENTIALS (password: Demo@1234)')
  console.log('-------------------------------------------')
  console.log('  ADMIN    ananya@aqtech.io   (Ananya Krishnan)')
  console.log('  MANAGER  vikram@aqtech.io   (Vikram Mehta - Engineering)')
  console.log('  MANAGER  deepa@aqtech.io    (Deepa Nair - Sales)')
  console.log('  EMPLOYEE arjun@aqtech.io    (Arjun Sharma - Engineering)')
  console.log('  EMPLOYEE sneha@aqtech.io    (Sneha Gupta - Engineering)')
  console.log('  EMPLOYEE rahul@aqtech.io    (Rahul Khanna - Sales)')
  console.log('  EMPLOYEE meera@aqtech.io    (Meera Joshi - Sales)')
  console.log('-------------------------------------------\n')
}

seed().catch((err) => {
  console.error('Seed failed:', err.message)
  process.exit(1)
})
