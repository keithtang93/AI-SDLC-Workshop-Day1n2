import { addDays, addMonths, addWeeks, addYears } from 'date-fns';
import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { Priority, RecurrencePattern, Todo, todoDB } from '@/lib/db';

function nextDueDate(currentDueDate: string, pattern: RecurrencePattern): string {
  const current = new Date(currentDueDate);
  switch (pattern) {
    case 'daily':
      return addDays(current, 1).toISOString();
    case 'weekly':
      return addWeeks(current, 1).toISOString();
    case 'monthly':
      return addMonths(current, 1).toISOString();
    case 'yearly':
      return addYears(current, 1).toISOString();
  }
}

function shouldCreateNext(inputCompleted: boolean, previous: Todo, next: Todo): boolean {
  return Boolean(inputCompleted && previous.completed === 0 && next.completed === 1 && previous.recurrence_pattern && previous.due_date);
}

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<NextResponse> {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const { id } = await params;
  const todo = todoDB.getById(session.userId, Number(id));
  if (!todo) {
    return NextResponse.json({ error: 'Todo not found' }, { status: 404 });
  }

  return NextResponse.json({ todo });
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<NextResponse> {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const { id } = await params;
  const todoId = Number(id);
  const existing = todoDB.getById(session.userId, todoId);
  if (!existing) {
    return NextResponse.json({ error: 'Todo not found' }, { status: 404 });
  }

  const body = await request.json();

  const updated = todoDB.update(session.userId, todoId, {
    title: body?.title,
    description: body?.description,
    priority: body?.priority as Priority,
    dueDate: body?.due_date,
    completed: typeof body?.completed === 'boolean' ? body.completed : undefined,
    reminderMinutes: body?.reminder_minutes,
    recurrencePattern: body?.recurrence_pattern as RecurrencePattern | null,
    tagIds: Array.isArray(body?.tag_ids) ? body.tag_ids : undefined,
    lastNotificationSent: body?.last_notification_sent
  });

  if (!updated) {
    return NextResponse.json({ error: 'Todo not found' }, { status: 404 });
  }

  if (shouldCreateNext(Boolean(body?.completed), existing, updated)) {
    const newDueDate = nextDueDate(existing.due_date as string, existing.recurrence_pattern as RecurrencePattern);
    todoDB.create({
      userId: session.userId,
      title: existing.title,
      description: existing.description,
      priority: existing.priority,
      dueDate: newDueDate,
      reminderMinutes: existing.reminder_minutes,
      recurrencePattern: existing.recurrence_pattern,
      tagIds: (existing.tags ?? []).map((tag) => tag.id)
    });
  }

  return NextResponse.json({ todo: updated });
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<NextResponse> {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const { id } = await params;
  todoDB.delete(session.userId, Number(id));
  return NextResponse.json({ success: true });
}
