import { NextResponse } from 'next/server';
import { differenceInMinutes } from 'date-fns';
import { getSession } from '@/lib/auth';
import { todoDB } from '@/lib/db';

export async function GET(): Promise<NextResponse> {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const todos = todoDB.listDueForNotification(session.userId);
  const now = new Date();
  const due = todos.filter((todo) => {
    if (!todo.due_date || todo.reminder_minutes === null || todo.last_notification_sent) {
      return false;
    }

    const minutesLeft = differenceInMinutes(new Date(todo.due_date), now);
    return minutesLeft <= (todo.reminder_minutes ?? 0);
  });

  for (const todo of due) {
    todoDB.update(session.userId, todo.id, {
      lastNotificationSent: now.toISOString()
    });
  }

  return NextResponse.json({ notifications: due.map((todo) => ({ id: todo.id, title: todo.title, due_date: todo.due_date })) });
}
