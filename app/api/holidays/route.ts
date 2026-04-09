import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { holidayDB } from '@/lib/db'

export async function GET(request: Request) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  // Seed holidays on first access
  holidayDB.seed()

  const { searchParams } = new URL(request.url)
  const yearStr = searchParams.get('year')
  const monthStr = searchParams.get('month')

  if (yearStr && monthStr) {
    const year = parseInt(yearStr, 10)
    const month = parseInt(monthStr, 10)
    if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
      return NextResponse.json({ error: 'Invalid year or month' }, { status: 400 })
    }
    const holidays = holidayDB.findByMonth(year, month)
    return NextResponse.json(holidays)
  }

  if (yearStr) {
    const year = parseInt(yearStr, 10)
    if (isNaN(year)) {
      return NextResponse.json({ error: 'Invalid year' }, { status: 400 })
    }
    const holidays = holidayDB.findByYear(year)
    return NextResponse.json(holidays)
  }

  // Default to current year
  const now = new Date()
  const sgYear = parseInt(now.toLocaleString('en-US', { timeZone: 'Asia/Singapore', year: 'numeric' }))
  const holidays = holidayDB.findByYear(sgYear)
  return NextResponse.json(holidays)
}
