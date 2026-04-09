import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { todoDB } from '@/lib/db'
import { isValidFutureDate } from '@/lib/timezone'

const VALID_PRIORITIES = ['high', 'medium', 'low']
const VALID_PATTERNS = ['daily', 'weekly', 'monthly', 'yearly']
const VALID_REMINDER_MINUTES = [15, 30, 60, 120, 1440, 2880, 10080]

export async function GET() {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const todos = todoDB.findAllByUser(session.userId)
  return NextResponse.json(todos)
}

export async function POST(request: Request) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { title, priority, due_date, is_recurring, recurrence_pattern, reminder_minutes } = body

    // Validate title
    if (!title || typeof title !== 'string' || !title.trim()) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 })
    }

    // Validate priority
    if (priority && !VALID_PRIORITIES.includes(priority)) {
      return NextResponse.json({ error: 'Priority must be high, medium, or low' }, { status: 400 })
    }

    // Validate due date
    if (due_date) {
      if (!isValidFutureDate(due_date)) {
        return NextResponse.json({ error: 'Due date must be at least 1 minute in the future' }, { status: 400 })
      }
    }

    // Validate recurring
    if (is_recurring) {
      if (!due_date) {
        return NextResponse.json({ error: 'Recurring todos must have a due date' }, { status: 400 })
      }
      if (!recurrence_pattern || !VALID_PATTERNS.includes(recurrence_pattern)) {
        return NextResponse.json({ error: 'Valid recurrence pattern is required for recurring todos' }, { status: 400 })
      }
    }

    // Validate reminder
    if (reminder_minutes !== undefined && reminder_minutes !== null) {
      if (!VALID_REMINDER_MINUTES.includes(reminder_minutes)) {
        return NextResponse.json({ error: 'Invalid reminder duration' }, { status: 400 })
      }
      if (!due_date) {
        return NextResponse.json({ error: 'Reminder requires a due date' }, { status: 400 })
      }
    }

    const todoId = todoDB.create({
      user_id: session.userId,
      title: title.trim(),
      priority: priority || 'medium',
      due_date: due_date || null,
      is_recurring: !!is_recurring,
      recurrence_pattern: is_recurring ? recurrence_pattern : null,
      reminder_minutes: reminder_minutes ?? null,
    })

    const todo = todoDB.findById(todoId, session.userId)
    return NextResponse.json(todo, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Failed to create todo' }, { status: 500 })
  }
}
