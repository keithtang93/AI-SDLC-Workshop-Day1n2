import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { templateDB } from '@/lib/db'
import type { Priority, RecurrencePattern } from '@/lib/db'
import { logger } from '@/lib/logger'

export async function GET(request: NextRequest) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const url = new URL(request.url)
  const category = url.searchParams.get('category') ?? undefined
  const templates = templateDB.findAllByUser(session.userId, category)
  return NextResponse.json(templates)
}

export async function POST(request: NextRequest) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { name, description, category, titleTemplate, priority, isRecurring, recurrencePattern, reminderMinutes, dueDateOffsetDays, subtasksJson } = body

    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json({ error: 'Template name is required' }, { status: 400 })
    }
    if (!titleTemplate || typeof titleTemplate !== 'string' || !titleTemplate.trim()) {
      return NextResponse.json({ error: 'Title template is required' }, { status: 400 })
    }

    const template = templateDB.create({
      user_id: session.userId,
      name: name.trim(),
      description: description ?? null,
      category: category ?? null,
      title_template: titleTemplate.trim(),
      priority: priority as Priority ?? 'medium',
      is_recurring: !!isRecurring,
      recurrence_pattern: isRecurring ? recurrencePattern as RecurrencePattern : null,
      reminder_minutes: reminderMinutes != null ? Number(reminderMinutes) : null,
      due_date_offset_days: dueDateOffsetDays != null ? Number(dueDateOffsetDays) : null,
      subtasks_json: subtasksJson ?? null,
    })

    return NextResponse.json(template, { status: 201 })
  } catch (error) {
    logger.error('templates/create', error)
    return NextResponse.json({ error: 'Failed to create template' }, { status: 500 })
  }
}
