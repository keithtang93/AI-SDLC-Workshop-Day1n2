import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { todoDB, subtaskDB } from '@/lib/db'

export async function POST(
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

  const todo = todoDB.findById(todoId, session.userId)
  if (!todo) {
    return NextResponse.json({ error: 'Todo not found' }, { status: 404 })
  }

  try {
    const { title } = await request.json()

    if (!title || typeof title !== 'string' || !title.trim()) {
      return NextResponse.json({ error: 'Subtask title is required' }, { status: 400 })
    }

    const subtaskId = subtaskDB.create(todoId, title.trim())
    const subtask = subtaskDB.findById(subtaskId)
    return NextResponse.json(subtask, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Failed to create subtask' }, { status: 500 })
  }
}
