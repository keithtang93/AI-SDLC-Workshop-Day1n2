import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { tagDB } from '@/lib/db'

const HEX_COLOR_REGEX = /^#[0-9a-fA-F]{6}$/

export async function GET() {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const tags = tagDB.findAllByUser(session.userId)
  return NextResponse.json(tags)
}

export async function POST(request: Request) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  try {
    const { name, color } = await request.json()

    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json({ error: 'Tag name is required' }, { status: 400 })
    }

    if (!color || !HEX_COLOR_REGEX.test(color)) {
      return NextResponse.json({ error: 'Valid hex color is required (e.g., #3B82F6)' }, { status: 400 })
    }

    // Check uniqueness
    const existing = tagDB.findAllByUser(session.userId)
    if (existing.some(t => t.name.toLowerCase() === name.trim().toLowerCase())) {
      return NextResponse.json({ error: 'A tag with this name already exists' }, { status: 409 })
    }

    const tagId = tagDB.create(session.userId, name.trim(), color)
    const tag = tagDB.findById(tagId, session.userId)
    return NextResponse.json(tag, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Failed to create tag' }, { status: 500 })
  }
}
