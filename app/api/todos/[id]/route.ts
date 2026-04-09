import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { todoDB, todoTagDB } from '@/lib/db'
import type { Priority, RecurrencePattern } from '@/lib/db'
import { calculateNextDueDate } from '@/lib/timezone'
import { logger } from '@/lib/logger'
import { VALID_PRIORITIES, VALID_PATTERNS, VALID_REMINDERS } from '@/lib/todo-utils'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const { id } = await params
  const todo = todoDB.findByIdWithRelations(id, session.userId)
  if (!todo) {
    return NextResponse.json({ error: 'Todo not found' }, { status: 404 })
  }

  return NextResponse.json(todo)
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
  const existing = todoDB.findById(id, session.userId)
  if (!existing) {
    return NextResponse.json({ error: 'Todo not found' }, { status: 404 })
  }

  try {
    const body = await request.json()
    const { title, priority, dueDate, completed, isRecurring, recurrencePattern, reminderMinutes, tagIds, lastNotificationSent } = body

    // Validate title if provided
    if (title !== undefined) {
      if (!title || typeof title !== 'string' || !title.trim()) {
        return NextResponse.json({ error: 'Title is required' }, { status: 400 })
      }
    }

    // Validate priority if provided
    if (priority !== undefined && !VALID_PRIORITIES.includes(priority)) {
      return NextResponse.json({ error: 'Invalid priority' }, { status: 400 })
    }

    // Validate recurring
    const willBeRecurring = isRecurring !== undefined ? isRecurring : existing.is_recurring
    const effectiveDueDate = dueDate !== undefined ? dueDate : existing.due_date
    const effectivePattern = recurrencePattern !== undefined ? recurrencePattern : existing.recurrence_pattern

    if (willBeRecurring) {
      if (!effectiveDueDate) {
        return NextResponse.json({ error: 'Recurring todos require a due date' }, { status: 400 })
      }
      if (!effectivePattern || !VALID_PATTERNS.includes(effectivePattern)) {
        return NextResponse.json({ error: 'Invalid recurrence pattern' }, { status: 400 })
      }
    }

    // Validate reminder
    const effectiveReminder = reminderMinutes !== undefined ? reminderMinutes : existing.reminder_minutes
    if (effectiveReminder != null && !effectiveDueDate) {
      return NextResponse.json({ error: 'Reminders require a due date' }, { status: 400 })
    }
    if (effectiveReminder != null && !VALID_REMINDERS.includes(Number(effectiveReminder))) {
      return NextResponse.json({ error: 'Invalid reminder value' }, { status: 400 })
    }

    // Recurring completion: create next instance
    if (completed === true && !existing.completed && existing.is_recurring && existing.due_date && existing.recurrence_pattern) {
      const nextDueDate = calculateNextDueDate(existing.due_date, existing.recurrence_pattern)
      const newTodo = todoDB.create({
        user_id: session.userId,
        title: existing.title,
        priority: existing.priority,
        due_date: nextDueDate,
        is_recurring: true,
        recurrence_pattern: existing.recurrence_pattern,
        reminder_minutes: existing.reminder_minutes,
      })

      // Copy tags to new instance
      const existingTags = todoTagDB.findByTodoId(id)
      if (existingTags.length > 0) {
        todoTagDB.setTagsForTodo(newTodo.id, existingTags.map(t => t.id))
      }
    }

    const updateData: Record<string, unknown> = {}
    if (title !== undefined) updateData.title = title.trim()
    if (priority !== undefined) updateData.priority = priority
    if (dueDate !== undefined) updateData.due_date = dueDate
    if (completed !== undefined) updateData.completed = completed
    if (isRecurring !== undefined) updateData.is_recurring = isRecurring
    if (recurrencePattern !== undefined) updateData.recurrence_pattern = isRecurring === false ? null : recurrencePattern
    if (reminderMinutes !== undefined) updateData.reminder_minutes = reminderMinutes
    if (lastNotificationSent !== undefined) updateData.last_notification_sent = lastNotificationSent
    if (completed !== undefined && lastNotificationSent === undefined) updateData.last_notification_sent = null

    todoDB.update(id, session.userId, updateData as Parameters<typeof todoDB.update>[2])

    // Update tags if provided
    if (Array.isArray(tagIds)) {
      todoTagDB.setTagsForTodo(id, tagIds)
    }

    const updated = todoDB.findByIdWithRelations(id, session.userId)
    return NextResponse.json(updated)
  } catch (error) {
    logger.error('todos/update', error)
    return NextResponse.json({ error: 'Failed to update todo' }, { status: 500 })
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
  const deleted = todoDB.remove(id, session.userId)
  if (!deleted) {
    return NextResponse.json({ error: 'Todo not found' }, { status: 404 })
  }

  return NextResponse.json({ success: true })
}
