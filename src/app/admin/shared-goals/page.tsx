import { requireRole } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { Share2 } from 'lucide-react'
import { SharedGoalForm } from './SharedGoalForm'
import type { SelectGoalCycle } from '@/types'

interface EmployeeOption {
  id: string
  full_name: string
  email: string
  department: string | null
}

export default async function SharedGoalsPage() {
  await requireRole('admin')
  const supabase = await createClient()

  // Fetch the active goal_setting cycle
  const { data: cycle } = await supabase
    .from('goal_cycles')
    .select('id, name, year, phase, status')
    .eq('status', 'active')
    .eq('phase', 'goal_setting')
    .limit(1)
    .maybeSingle() as { data: SelectGoalCycle | null }

  // Fetch all active employees
  const { data: employees } = await supabase
    .from('users')
    .select('id, full_name, email, department')
    .eq('role', 'employee')
    .eq('is_active', true)
    .order('full_name', { ascending: true })

  const employeeOptions: EmployeeOption[] = (employees ?? []) as EmployeeOption[]

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Share2 className="w-6 h-6 text-teal-600" />
            Push Shared Goal
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Push a departmental or company-wide goal to multiple employees. Recipients can only edit the weightage.
          </p>
        </div>

        {!cycle ? (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 text-amber-800">
            <p className="font-medium">No active goal-setting cycle</p>
            <p className="text-sm mt-1">Shared goals can only be pushed during an active goal_setting cycle.</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <div className="mb-4 text-sm text-gray-600 bg-blue-50 border border-blue-100 rounded-md px-3 py-2">
              Active Cycle: <strong>{cycle.name}</strong> &bull; {cycle.year}
            </div>
            <SharedGoalForm cycleId={cycle.id} employees={employeeOptions} />
          </div>
        )}
      </div>
    </div>
  )
}
