const SINGAPORE_TZ = 'Asia/Singapore'

export function getSingaporeNow(): Date {
  const nowStr = new Date().toLocaleString('en-US', { timeZone: SINGAPORE_TZ })
  return new Date(nowStr)
}

export function toSingaporeISOString(date: Date): string {
  const sgDate = new Date(date.toLocaleString('en-US', { timeZone: SINGAPORE_TZ }))
  const year = sgDate.getFullYear()
  const month = String(sgDate.getMonth() + 1).padStart(2, '0')
  const day = String(sgDate.getDate()).padStart(2, '0')
  const hours = String(sgDate.getHours()).padStart(2, '0')
  const minutes = String(sgDate.getMinutes()).padStart(2, '0')
  const seconds = String(sgDate.getSeconds()).padStart(2, '0')
  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}+08:00`
}

export function formatSingaporeDate(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleString('en-SG', {
    timeZone: SINGAPORE_TZ,
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  })
}

export function isSingaporePast(dateStr: string): boolean {
  const dueDate = new Date(dateStr)
  const now = getSingaporeNow()
  return dueDate.getTime() < now.getTime()
}

export function isFutureEnough(dateStr: string): boolean {
  const dueDate = new Date(dateStr)
  const now = getSingaporeNow()
  const oneMinute = 60 * 1000
  return dueDate.getTime() - now.getTime() >= oneMinute
}

export type RecurrencePattern = 'daily' | 'weekly' | 'monthly' | 'yearly'

export function calculateNextDueDate(currentDueDate: string, pattern: RecurrencePattern): string {
  const date = new Date(currentDueDate)

  switch (pattern) {
    case 'daily':
      date.setDate(date.getDate() + 1)
      break
    case 'weekly':
      date.setDate(date.getDate() + 7)
      break
    case 'monthly': {
      const currentDay = date.getDate()
      date.setMonth(date.getMonth() + 1)
      // Handle month-end edge cases (e.g., Jan 31 → Feb 28)
      if (date.getDate() !== currentDay) {
        date.setDate(0) // Go to last day of previous month
      }
      break
    }
    case 'yearly': {
      const currentDay = date.getDate()
      date.setFullYear(date.getFullYear() + 1)
      // Handle leap year edge case (Feb 29 → Feb 28)
      if (date.getDate() !== currentDay) {
        date.setDate(0)
      }
      break
    }
  }

  return date.toISOString()
}
