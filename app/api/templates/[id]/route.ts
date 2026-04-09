import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { Priority, RecurrencePattern, templateDB } from "@/lib/db";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();

  const template = templateDB.update(session.userId, Number(id), {
    name: body?.name,
    category: body?.category,
    title: body?.title,
    description: body?.description,
    priority: body?.priority as Priority,
    reminderMinutes: body?.reminder_minutes,
    recurrencePattern: body?.recurrence_pattern as RecurrencePattern | null,
    tagsJson: body?.tags_json,
    subtasksJson: body?.subtasks_json,
  });

  if (!template) {
    return NextResponse.json(
      { error: "Template not found" },
      { status: 404 },
    );
  }

  return NextResponse.json({ template });
}

export async function DELETE(
  _: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { id } = await params;
  templateDB.delete(session.userId, Number(id));
  return NextResponse.json({ success: true });
}
