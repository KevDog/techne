import { revalidatePath } from 'next/cache'

const SHOW_PAGE = '/[orgSlug]/shows/[showSlug]'
const DEPT_PAGE = '/[orgSlug]/shows/[showSlug]/departments/[deptSlug]'
const MEETING_PAGE = '/[orgSlug]/shows/[showSlug]/meetings/[meetingId]'
const SHOWS_LIST = '/[orgSlug]/shows'

export function revalidateDepartment(): void {
  revalidatePath(DEPT_PAGE, 'page')
  revalidatePath(SHOW_PAGE, 'page')
}

export function revalidateShow(): void {
  revalidatePath(SHOW_PAGE, 'page')
  revalidatePath(SHOWS_LIST, 'page')
}

export function revalidateMeeting(): void {
  revalidatePath(MEETING_PAGE, 'page')
  revalidatePath(SHOW_PAGE, 'page')
}
