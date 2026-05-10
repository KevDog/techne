import type { MaterialState } from '@/lib/types/domain'

export function isValidTransition(
  from: MaterialState,
  to: MaterialState,
  allowReopen: boolean
): boolean {
  if (from === 'exploratory' && to === 'proposed') return true
  if (from === 'proposed' && to === 'decided') return true
  if (from === 'decided' && to === 'proposed') return allowReopen
  return false
}
