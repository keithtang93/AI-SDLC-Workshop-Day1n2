import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { todoDB } from '@/lib/db'

export async function GET() {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const dueReminders = todoDB.findDueReminders()

  // Filter to only this user's reminders and mark as sent
  const userReminders = dueReminders.filter(r => r.user_id === session.userId)

  for (const reminder of userReminders) {
    todoDB.markNotificationSent(reminder.id)
  }

  return NextResponse.json(
    userReminders.map(r => ({
      id: r.id,
      title: r.title,
      due_date: r.due_date,
    }))
  )
}
