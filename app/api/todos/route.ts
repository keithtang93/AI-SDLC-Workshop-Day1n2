import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { todoDB, todoTagDB } from '@/lib/db'
import type { Priority, RecurrencePattern } from '@/lib/db'
import { isFutureEnough } from '@/lib/timezone'
import { logger } from '@/lib/logger'
import { VALID_PRIORITIES, VALID_PATTERNS, VALID_REMINDERS } from '@/lib/todo-utils'

export async function GET(request: NextRequest) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const pageParam = searchParams.get('page')
  const limitParam = searchParams.get('limit')

  if (pageParam != null || limitParam != null) {
    const page = Math.max(1, parseInt(pageParam ?? '1', 10) || 1)
    const limit = Math.min(100, Math.max(1, parseInt(limitParam ?? '20', 10) || 20))
    const offset = (page - 1) * limit
    const total = todoDB.countByUser(session.userId)
    const todos = todoDB.findAllByUserWithRelations(session.userId, { limit, offset })

    return NextResponse.json({
      data: todos,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    })
  }

  const todos = todoDB.findAllByUserWithRelations(session.userId)
  return NextResponse.json(todos)
}

export async function POST(request: NextRequest) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { title, priority, dueDate, isRecurring, recurrencePattern, reminderMinutes, tagIds } = body

    // Validate title
    if (!title || typeof title !== 'string' || !title.trim()) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 })
    }

    // Validate priority
    const todoPriority = priority || 'medium'
    if (!VALID_PRIORITIES.includes(todoPriority)) {
      return NextResponse.json({ error: 'Invalid priority' }, { status: 400 })
    }

    // Validate due date
    if (dueDate) {
      if (!isFutureEnough(dueDate)) {
        return NextResponse.json({ error: 'Due date must be at least 1 minute in the future' }, { status: 400 })
      }
    }

    // Validate recurring
    if (isRecurring) {
      if (!dueDate) {
        return NextResponse.json({ error: 'Recurring todos require a due date' }, { status: 400 })
      }
      if (!recurrencePattern || !VALID_PATTERNS.includes(recurrencePattern)) {
        return NextResponse.json({ error: 'Invalid recurrence pattern' }, { status: 400 })
      }
    }

    // Validate reminder
    if (reminderMinutes != null) {
      if (!dueDate) {
        return NextResponse.json({ error: 'Reminders require a due date' }, { status: 400 })
      }
      if (!VALID_REMINDERS.includes(Number(reminderMinutes))) {
        return NextResponse.json({ error: 'Invalid reminder value' }, { status: 400 })
      }
    }

    const todo = todoDB.create({
      user_id: session.userId,
      title: title.trim(),
      priority: todoPriority,
      due_date: dueDate ?? null,
      is_recurring: !!isRecurring,
      recurrence_pattern: isRecurring ? recurrencePattern : null,
      reminder_minutes: reminderMinutes != null ? Number(reminderMinutes) : null,
    })

    // Attach tags if provided
    if (Array.isArray(tagIds) && tagIds.length > 0) {
      todoTagDB.setTagsForTodo(todo.id, tagIds)
    }

    const todoWithRelations = todoDB.findByIdWithRelations(todo.id, session.userId)
    return NextResponse.json(todoWithRelations, { status: 201 })
  } catch (error) {
    logger.error('todos/create', error)
    return NextResponse.json({ error: 'Failed to create todo' }, { status: 500 })
  }
}
