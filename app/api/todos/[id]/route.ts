import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { todoDB, todoTagDB } from '@/lib/db'
import { isValidFutureDate, addIntervalSingapore } from '@/lib/timezone'

const VALID_PRIORITIES = ['high', 'medium', 'low']
const VALID_PATTERNS = ['daily', 'weekly', 'monthly', 'yearly']
const VALID_REMINDER_MINUTES = [15, 30, 60, 120, 1440, 2880, 10080]

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const { id } = await params
  const todoId = parseInt(id, 10)
  if (isNaN(todoId)) {
    return NextResponse.json({ error: 'Invalid todo ID' }, { status: 400 })
  }

  const todo = todoDB.findById(todoId, session.userId)
  if (!todo) {
    return NextResponse.json({ error: 'Todo not found' }, { status: 404 })
  }

  return NextResponse.json(todo)
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const { id } = await params
  const todoId = parseInt(id, 10)
  if (isNaN(todoId)) {
    return NextResponse.json({ error: 'Invalid todo ID' }, { status: 400 })
  }

  const existing = todoDB.findById(todoId, session.userId)
  if (!existing) {
    return NextResponse.json({ error: 'Todo not found' }, { status: 404 })
  }

  try {
    const body = await request.json()
    const { title, completed, priority, due_date, is_recurring, recurrence_pattern, reminder_minutes } = body

    // Validate title if provided
    if (title !== undefined && (typeof title !== 'string' || !title.trim())) {
      return NextResponse.json({ error: 'Title cannot be empty' }, { status: 400 })
    }

    // Validate priority if provided
    if (priority !== undefined && !VALID_PRIORITIES.includes(priority)) {
      return NextResponse.json({ error: 'Priority must be high, medium, or low' }, { status: 400 })
    }

    // Validate due date if provided
    if (due_date !== undefined && due_date !== null) {
      if (!isValidFutureDate(due_date)) {
        return NextResponse.json({ error: 'Due date must be at least 1 minute in the future' }, { status: 400 })
      }
    }

    // Validate recurring if provided
    if (is_recurring) {
      const effectiveDueDate = due_date !== undefined ? due_date : existing.due_date
      if (!effectiveDueDate) {
        return NextResponse.json({ error: 'Recurring todos must have a due date' }, { status: 400 })
      }
      if (recurrence_pattern && !VALID_PATTERNS.includes(recurrence_pattern)) {
        return NextResponse.json({ error: 'Invalid recurrence pattern' }, { status: 400 })
      }
    }

    // Validate reminder if provided
    if (reminder_minutes !== undefined && reminder_minutes !== null) {
      if (!VALID_REMINDER_MINUTES.includes(reminder_minutes)) {
        return NextResponse.json({ error: 'Invalid reminder duration' }, { status: 400 })
      }
    }

    // Handle recurring completion: create next instance
    let newRecurringTodo = null
    if (completed === true && !existing.completed && existing.is_recurring && existing.due_date && existing.recurrence_pattern) {
      const nextDueDate = addIntervalSingapore(existing.due_date, existing.recurrence_pattern as 'daily' | 'weekly' | 'monthly' | 'yearly')

      const newTodoId = todoDB.create({
        user_id: session.userId,
        title: existing.title,
        priority: existing.priority,
        due_date: nextDueDate,
        is_recurring: true,
        recurrence_pattern: existing.recurrence_pattern,
        reminder_minutes: existing.reminder_minutes,
      })

      // Copy tags to new instance
      const tags = todoTagDB.findByTodo(todoId)
      for (const tag of tags) {
        todoTagDB.assign(newTodoId, tag.id)
      }

      newRecurringTodo = todoDB.findById(newTodoId, session.userId)
    }

    // Update the todo
    todoDB.update(todoId, session.userId, {
      title: title !== undefined ? title : undefined,
      completed: completed !== undefined ? completed : undefined,
      priority: priority !== undefined ? priority : undefined,
      due_date: due_date !== undefined ? due_date : undefined,
      is_recurring: is_recurring !== undefined ? is_recurring : undefined,
      recurrence_pattern: recurrence_pattern !== undefined ? recurrence_pattern : undefined,
      reminder_minutes: reminder_minutes !== undefined ? reminder_minutes : undefined,
    })

    const updated = todoDB.findById(todoId, session.userId)
    return NextResponse.json({ todo: updated, newRecurringTodo })
  } catch {
    return NextResponse.json({ error: 'Failed to update todo' }, { status: 500 })
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const { id } = await params
  const todoId = parseInt(id, 10)
  if (isNaN(todoId)) {
    return NextResponse.json({ error: 'Invalid todo ID' }, { status: 400 })
  }

  const existing = todoDB.findById(todoId, session.userId)
  if (!existing) {
    return NextResponse.json({ error: 'Todo not found' }, { status: 404 })
  }

  todoDB.delete(todoId, session.userId)
  return NextResponse.json({ success: true })
}
