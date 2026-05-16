/**
 * Shared goal utilities — pure functions used by both API routes and components.
 */

import type { UomType, GoalStatus } from '@/types'

export const THRUST_AREA_SUGGESTIONS = [
  'Revenue',
  'Cost',
  'Quality',
  'Customer',
  'People',
  'Safety',
]

export const UOM_LABELS: Record<UomType, string> = {
  min_numeric: 'Min Numeric',
  max_numeric: 'Max Numeric',
  min_percent: 'Min %',
  max_percent: 'Max %',
  timeline: 'Timeline',
  zero: 'Zero Incidents',
}

export const STATUS_META: Record<
  GoalStatus,
  { label: string; color: string }
> = {
  draft: { label: 'Draft', color: 'bg-gray-100 text-gray-700' },
  submitted: { label: 'Submitted', color: 'bg-blue-100 text-blue-700' },
  approved: { label: 'Approved', color: 'bg-green-100 text-green-700' },
  returned: { label: 'Returned', color: 'bg-red-100 text-red-700' },
  locked: { label: 'Locked', color: 'bg-purple-100 text-purple-700' },
}

export interface GoalFormData {
  thrustArea: string
  title: string
  description: string
  uomType: UomType
  target: string
  weightage: number
}

export interface ValidationResult {
  valid: boolean
  errors: Record<string, string>
}

export function validateGoalForm(
  data: GoalFormData,
  usedWeightage: number,
  currentGoalWeightage = 0
): ValidationResult {
  const errors: Record<string, string> = {}

  if (!data.thrustArea.trim()) errors.thrustArea = 'Thrust area is required'
  if (!data.title.trim()) errors.title = 'Title is required'
  if (!data.uomType) errors.uomType = 'UoM type is required'

  if (data.uomType !== 'zero') {
    if (!data.target.trim()) {
      errors.target = 'Target is required'
    } else if (data.uomType === 'timeline') {
      if (isNaN(Date.parse(data.target))) errors.target = 'Enter a valid date'
    } else {
      const n = Number(data.target)
      if (isNaN(n) || n <= 0) errors.target = 'Enter a positive number'
    }
  }

  if (!data.weightage || data.weightage < 10) {
    errors.weightage = 'Minimum weightage is 10%'
  } else if (data.weightage % 10 !== 0) {
    errors.weightage = 'Weightage must be a multiple of 10'
  } else {
    const available = 100 - usedWeightage + currentGoalWeightage
    if (data.weightage > available) {
      errors.weightage = `Only ${available}% weightage available`
    }
  }

  return { valid: Object.keys(errors).length === 0, errors }
}

export function isEditable(status: GoalStatus): boolean {
  return status === 'draft' || status === 'returned'
}

export function getTargetDisplay(uomType: UomType, target: string): string {
  if (uomType === 'zero') return '0 = Success'
  if (uomType === 'timeline') return new Date(target).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
  const unit = uomType.includes('percent') ? '%' : ''
  return `${target}${unit}`
}
