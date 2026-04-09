import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { todoDB } from '@/lib/db'
import { toSingaporeISOString } from '@/lib/timezone'

export async function GET() {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const nowISO = toSingaporeISOString(new Date())
  const dueTodos = todoDB.findDueReminders(session.userId, nowISO)
  return NextResponse.json(dueTodos)
}
