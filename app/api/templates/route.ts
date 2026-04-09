import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { Priority, RecurrencePattern, templateDB } from "@/lib/db";

export async function GET(): Promise<NextResponse> {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  return NextResponse.json({
    templates: templateDB.listByUserId(session.userId),
  });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await request.json();
  const name = String(body?.name ?? "").trim();
  const title = String(body?.title ?? "").trim();
  if (!name || !title) {
    return NextResponse.json(
      { error: "Template name and title are required" },
      { status: 400 },
    );
  }

  const template = templateDB.create(session.userId, {
    name,
    category: body?.category ?? null,
    title,
    description: body?.description ?? null,
    priority: (body?.priority ?? "medium") as Priority,
    reminderMinutes: body?.reminder_minutes ?? null,
    recurrencePattern: (body?.recurrence_pattern ??
      null) as RecurrencePattern | null,
    tagsJson: JSON.stringify(body?.tags ?? []),
    subtasksJson: JSON.stringify(body?.subtasks ?? []),
  });

  return NextResponse.json({ template }, { status: 201 });
}
