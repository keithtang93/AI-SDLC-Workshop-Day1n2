import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { templateDB } from '@/lib/db'

const VALID_PRIORITIES = ['high', 'medium', 'low']
const VALID_PATTERNS = ['daily', 'weekly', 'monthly', 'yearly']
const VALID_REMINDER_MINUTES = [15, 30, 60, 120, 1440, 2880, 10080]

export async function GET() {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const templates = templateDB.findAllByUser(session.userId)
  return NextResponse.json(templates)
}

export async function POST(request: Request) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { name, description, category, title_template, priority, is_recurring, recurrence_pattern, reminder_minutes, subtasks_json } = body

    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json({ error: 'Template name is required' }, { status: 400 })
    }

    if (!title_template || typeof title_template !== 'string' || !title_template.trim()) {
      return NextResponse.json({ error: 'Title template is required' }, { status: 400 })
    }

    if (priority && !VALID_PRIORITIES.includes(priority)) {
      return NextResponse.json({ error: 'Invalid priority' }, { status: 400 })
    }

    if (is_recurring && recurrence_pattern && !VALID_PATTERNS.includes(recurrence_pattern)) {
      return NextResponse.json({ error: 'Invalid recurrence pattern' }, { status: 400 })
    }

    if (reminder_minutes !== undefined && reminder_minutes !== null && reminder_minutes !== 0) {
      if (!VALID_REMINDER_MINUTES.includes(reminder_minutes)) {
        return NextResponse.json({ error: 'Invalid reminder duration' }, { status: 400 })
      }
    }

    if (subtasks_json) {
      try {
        const parsed = JSON.parse(subtasks_json)
        if (!Array.isArray(parsed)) {
          return NextResponse.json({ error: 'subtasks_json must be a JSON array' }, { status: 400 })
        }
      } catch {
        return NextResponse.json({ error: 'Invalid subtasks_json format' }, { status: 400 })
      }
    }

    const id = templateDB.create({
      user_id: session.userId,
      name: name.trim(),
      description: description || null,
      category: category || null,
      title_template: title_template.trim(),
      priority: priority || 'medium',
      is_recurring: !!is_recurring,
      recurrence_pattern: recurrence_pattern || null,
      reminder_minutes: reminder_minutes || null,
      subtasks_json: subtasks_json || null,
    })

    const template = templateDB.findById(id, session.userId)
    return NextResponse.json(template, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
}
