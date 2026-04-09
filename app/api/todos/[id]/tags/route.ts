import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { todoDB, tagDB, todoTagDB } from '@/lib/db'

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
    const { tagId } = await request.json()

    if (!tagId || typeof tagId !== 'number') {
      return NextResponse.json({ error: 'Tag ID is required' }, { status: 400 })
    }

    const tag = tagDB.findById(tagId, session.userId)
    if (!tag) {
      return NextResponse.json({ error: 'Tag not found' }, { status: 404 })
    }

    todoTagDB.assign(todoId, tagId)
    return NextResponse.json({ success: true }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Failed to assign tag' }, { status: 500 })
  }
}

export async function DELETE(
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
    const { tagId } = await request.json()

    if (!tagId || typeof tagId !== 'number') {
      return NextResponse.json({ error: 'Tag ID is required' }, { status: 400 })
    }

    todoTagDB.remove(todoId, tagId)
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Failed to remove tag' }, { status: 500 })
  }
}
