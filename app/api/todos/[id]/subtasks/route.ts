import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { subtaskDB, todoDB } from '@/lib/db';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<NextResponse> {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const { id } = await params;
  const todo = todoDB.getById(session.userId, Number(id));
  if (!todo) {
    return NextResponse.json({ error: 'Todo not found' }, { status: 404 });
  }

  const body = await request.json();
  const title = String(body?.title ?? '').trim();
  if (!title) {
    return NextResponse.json({ error: 'Subtask title is required' }, { status: 400 });
  }

  const subtask = subtaskDB.create(Number(id), title);
  return NextResponse.json({ subtask }, { status: 201 });
}
