import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { templateDB } from '@/lib/db'
import type { Priority, RecurrencePattern } from '@/lib/db'
import { logger } from '@/lib/logger'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const { id } = await params
  const template = templateDB.findById(id, session.userId)
  if (!template) {
    return NextResponse.json({ error: 'Template not found' }, { status: 404 })
  }

  return NextResponse.json(template)
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const { id } = await params
  try {
    const body = await request.json()
    const updated = templateDB.update(id, session.userId, {
      name: body.name?.trim(),
      description: body.description,
      category: body.category,
      title_template: body.titleTemplate?.trim(),
      priority: body.priority as Priority,
      is_recurring: body.isRecurring,
      recurrence_pattern: body.recurrencePattern as RecurrencePattern,
      reminder_minutes: body.reminderMinutes != null ? Number(body.reminderMinutes) : undefined,
      due_date_offset_days: body.dueDateOffsetDays != null ? Number(body.dueDateOffsetDays) : undefined,
      subtasks_json: body.subtasksJson,
    })
    if (!updated) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 })
    }
    return NextResponse.json(updated)
  } catch (error) {
    logger.error('templates/update', error)
    return NextResponse.json({ error: 'Failed to update template' }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const { id } = await params
  const deleted = templateDB.remove(id, session.userId)
  if (!deleted) {
    return NextResponse.json({ error: 'Template not found' }, { status: 404 })
  }
  return NextResponse.json({ success: true })
}
