import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { holidayDB } from '@/lib/db'

export async function GET(request: NextRequest) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const url = new URL(request.url)
  const year = parseInt(url.searchParams.get('year') ?? String(new Date().getFullYear()), 10)

  if (isNaN(year) || year < 2000 || year > 2100) {
    return NextResponse.json({ error: 'Invalid year' }, { status: 400 })
  }

  const holidays = holidayDB.findByYear(year)
  return NextResponse.json(holidays)
}
