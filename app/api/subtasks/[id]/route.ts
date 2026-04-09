import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { subtaskDB } from '@/lib/db';

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<NextResponse> {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();

  const subtask = subtaskDB.update(Number(id), {
    title: body?.title,
    completed: typeof body?.completed === 'boolean' ? body.completed : undefined
  });

  if (!subtask) {
    return NextResponse.json({ error: 'Subtask not found' }, { status: 404 });
  }

  return NextResponse.json({ subtask });
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<NextResponse> {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const { id } = await params;
  subtaskDB.delete(Number(id));
  return NextResponse.json({ success: true });
}
