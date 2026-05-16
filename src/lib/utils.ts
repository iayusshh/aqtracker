import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function computeScore(
  uomType: string,
  target: number,
  actual: number
): number {
  switch (uomType) {
    case 'min_numeric':
    case 'min_percent':
      return Math.min((actual / target) * 100, 150)
    case 'max_numeric':
    case 'max_percent':
      return Math.min((target / actual) * 100, 150)
    case 'zero':
      return actual === 0 ? 100 : 0
    default:
      return 0
  }
}

export function computeTimelineScore(targetDate: Date, completionDate: Date | null): number {
  if (!completionDate) return 0
  return completionDate <= targetDate ? 100 : 0
}

export function getQuarterWindow(quarter: string): { open: Date; close: Date } {
  const year = new Date().getFullYear()
  const windows: Record<string, { open: Date; close: Date }> = {
    goal_setting: { open: new Date(`${year}-05-01`), close: new Date(`${year}-06-30`) },
    q1: { open: new Date(`${year}-07-01`), close: new Date(`${year}-09-30`) },
    q2: { open: new Date(`${year}-10-01`), close: new Date(`${year}-12-31`) },
    q3: { open: new Date(`${year + 1}-01-01`), close: new Date(`${year + 1}-03-31`) },
    q4_annual: { open: new Date(`${year + 1}-03-01`), close: new Date(`${year + 1}-04-30`) },
  }
  return windows[quarter] ?? { open: new Date(), close: new Date() }
}

export function formatDate(date: Date | string): string {
  return new Date(date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}
