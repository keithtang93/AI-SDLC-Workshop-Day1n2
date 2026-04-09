const SG_TZ = 'Asia/Singapore'

export function getSingaporeNow(): Date {
  const nowStr = new Date().toLocaleString('en-US', { timeZone: SG_TZ })
  return new Date(nowStr)
}

export function getSingaporeISO(): string {
  const now = new Date()
  return now.toLocaleString('sv-SE', { timeZone: SG_TZ }).replace(' ', 'T')
}

export function formatSingaporeDate(date: string | Date, style: 'short' | 'long' | 'datetime' = 'short'): string {
  const d = typeof date === 'string' ? new Date(date) : date
  if (isNaN(d.getTime())) return 'Invalid date'

  if (style === 'long') {
    return d.toLocaleDateString('en-SG', { timeZone: SG_TZ, weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })
  }
  if (style === 'datetime') {
    return d.toLocaleString('en-SG', { timeZone: SG_TZ, year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true })
  }
  return d.toLocaleDateString('en-SG', { timeZone: SG_TZ, year: 'numeric', month: '2-digit', day: '2-digit' })
}

export function toSingaporeDateString(date: Date): string {
  return date.toLocaleString('sv-SE', { timeZone: SG_TZ }).replace(' ', 'T')
}

export function isValidFutureDate(dateStr: string): boolean {
  const date = new Date(dateStr)
  if (isNaN(date.getTime())) return false
  const nowStr = new Date().toLocaleString('en-US', { timeZone: SG_TZ })
  const now = new Date(nowStr)
  const oneMinuteFromNow = new Date(now.getTime() + 60 * 1000)
  return date >= oneMinuteFromNow
}

export function addIntervalSingapore(dateStr: string, pattern: 'daily' | 'weekly' | 'monthly' | 'yearly'): string {
  const date = new Date(dateStr)
  if (isNaN(date.getTime())) throw new Error('Invalid date')

  const sgParts = new Intl.DateTimeFormat('en-US', {
    timeZone: SG_TZ,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  }).formatToParts(date)

  const get = (type: string) => parseInt(sgParts.find(p => p.type === type)?.value ?? '0')
  let year = get('year')
  let month = get('month')
  let day = get('day')
  const hour = get('hour')
  const minute = get('minute')
  const second = get('second')

  switch (pattern) {
    case 'daily':
      day += 1
      break
    case 'weekly':
      day += 7
      break
    case 'monthly': {
      month += 1
      if (month > 12) {
        month = 1
        year += 1
      }
      const maxDay = new Date(year, month, 0).getDate()
      if (day > maxDay) day = maxDay
      break
    }
    case 'yearly': {
      year += 1
      const maxDay = new Date(year, month, 0).getDate()
      if (day > maxDay) day = maxDay
      break
    }
  }

  const result = new Date(year, month - 1, day, hour, minute, second)
  return result.toISOString()
}

export function getReminderLabel(minutes: number): string {
  if (minutes < 60) return `${minutes}m`
  if (minutes < 1440) return `${minutes / 60}h`
  if (minutes < 10080) return `${minutes / 1440}d`
  return `${minutes / 10080}w`
}
