import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { subtaskDB, todoDB } from '@/lib/db'

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const { id } = await params
  const subtaskId = parseInt(id, 10)
  if (isNaN(subtaskId)) {
    return NextResponse.json({ error: 'Invalid subtask ID' }, { status: 400 })
  }

  const subtask = subtaskDB.findById(subtaskId)
  if (!subtask) {
    return NextResponse.json({ error: 'Subtask not found' }, { status: 404 })
  }

  // Verify ownership via parent todo
  const todo = todoDB.findById(subtask.todo_id, session.userId)
  if (!todo) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
  }

  try {
    const body = await request.json()
    const { title, completed } = body

    if (title !== undefined && (typeof title !== 'string' || !title.trim())) {
      return NextResponse.json({ error: 'Subtask title cannot be empty' }, { status: 400 })
    }

    subtaskDB.update(subtaskId, {
      title: title !== undefined ? title : undefined,
      completed: completed !== undefined ? completed : undefined,
    })

    const updated = subtaskDB.findById(subtaskId)
    return NextResponse.json(updated)
  } catch {
    return NextResponse.json({ error: 'Failed to update subtask' }, { status: 500 })
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
  const subtaskId = parseInt(id, 10)
  if (isNaN(subtaskId)) {
    return NextResponse.json({ error: 'Invalid subtask ID' }, { status: 400 })
  }

  const subtask = subtaskDB.findById(subtaskId)
  if (!subtask) {
    return NextResponse.json({ error: 'Subtask not found' }, { status: 404 })
  }

  const todo = todoDB.findById(subtask.todo_id, session.userId)
  if (!todo) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
  }

  subtaskDB.delete(subtaskId)
  return NextResponse.json({ success: true })
}
