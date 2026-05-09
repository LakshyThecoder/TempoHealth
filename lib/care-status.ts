/** Practice workflow labels for patient roster (CRM-lite). */
export const CARE_STATUS_OPTIONS = [
  { value: 'active', label: 'Active', color: '#22c55e' },
  { value: 'monitoring', label: 'Monitoring', color: '#3b82f6' },
  { value: 'review_needed', label: 'Review needed', color: '#f59e0b' },
  { value: 'stable', label: 'Stable', color: '#64748b' },
  { value: 'archived', label: 'Archived', color: '#475569' },
] as const

export type CareStatusValue = (typeof CARE_STATUS_OPTIONS)[number]['value']

export function isCareStatus(s: string): s is CareStatusValue {
  return CARE_STATUS_OPTIONS.some(o => o.value === s)
}
