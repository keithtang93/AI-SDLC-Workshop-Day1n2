import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { tagDB } from '@/lib/db'

const HEX_COLOR_REGEX = /^#[0-9a-fA-F]{6}$/

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const { id } = await params
  const tagId = parseInt(id, 10)
  if (isNaN(tagId)) {
    return NextResponse.json({ error: 'Invalid tag ID' }, { status: 400 })
  }

  const existing = tagDB.findById(tagId, session.userId)
  if (!existing) {
    return NextResponse.json({ error: 'Tag not found' }, { status: 404 })
  }

  try {
    const { name, color } = await request.json()

    if (name !== undefined && (typeof name !== 'string' || !name.trim())) {
      return NextResponse.json({ error: 'Tag name cannot be empty' }, { status: 400 })
    }

    if (color !== undefined && !HEX_COLOR_REGEX.test(color)) {
      return NextResponse.json({ error: 'Valid hex color is required' }, { status: 400 })
    }

    // Check uniqueness if name changed
    if (name && name.trim().toLowerCase() !== existing.name.toLowerCase()) {
      const allTags = tagDB.findAllByUser(session.userId)
      if (allTags.some(t => t.name.toLowerCase() === name.trim().toLowerCase())) {
        return NextResponse.json({ error: 'A tag with this name already exists' }, { status: 409 })
      }
    }

    tagDB.update(tagId, session.userId, {
      name: name !== undefined ? name : undefined,
      color: color !== undefined ? color : undefined,
    })

    const updated = tagDB.findById(tagId, session.userId)
    return NextResponse.json(updated)
  } catch {
    return NextResponse.json({ error: 'Failed to update tag' }, { status: 500 })
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
  const tagId = parseInt(id, 10)
  if (isNaN(tagId)) {
    return NextResponse.json({ error: 'Invalid tag ID' }, { status: 400 })
  }

  const existing = tagDB.findById(tagId, session.userId)
  if (!existing) {
    return NextResponse.json({ error: 'Tag not found' }, { status: 404 })
  }

  tagDB.delete(tagId, session.userId)
  return NextResponse.json({ success: true })
}
