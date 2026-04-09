import type { Priority, RecurrencePattern, Todo, TodoRow, Subtask, SubtaskRow, Template, TemplateRow } from './db'

// ─── Validation Constants ─────────────────────────────────────────────────────

export const VALID_PRIORITIES: Priority[] = ['high', 'medium', 'low']
export const VALID_PATTERNS: RecurrencePattern[] = ['daily', 'weekly', 'monthly', 'yearly']
export const VALID_REMINDERS = [15, 30, 60, 120, 1440, 2880, 10080]

// ─── Validation Functions ─────────────────────────────────────────────────────

export function isValidPriority(value: string): value is Priority {
  return VALID_PRIORITIES.includes(value as Priority)
}

export function isValidRecurrencePattern(value: string): value is RecurrencePattern {
  return VALID_PATTERNS.includes(value as RecurrencePattern)
}

export function isValidReminder(minutes: number): boolean {
  return VALID_REMINDERS.includes(minutes)
}

export function sanitizePriority(value: unknown): Priority {
  if (typeof value === 'string' && isValidPriority(value)) return value
  return 'medium'
}

export function sanitizeRecurrencePattern(value: unknown): RecurrencePattern | null {
  if (typeof value === 'string' && isValidRecurrencePattern(value)) return value
  return null
}

// ─── Row Conversion Functions ─────────────────────────────────────────────────

export function rowToTodo(row: TodoRow): Todo {
  return {
    ...row,
    priority: row.priority as Priority,
    completed: row.completed === 1,
    is_recurring: row.is_recurring === 1,
    recurrence_pattern: (row.recurrence_pattern as RecurrencePattern) ?? null,
    reminder_minutes: row.reminder_minutes ?? null,
    last_notification_sent: row.last_notification_sent ?? null,
    description: row.description ?? null,
    due_date: row.due_date ?? null,
  }
}

export function rowToSubtask(row: SubtaskRow): Subtask {
  return {
    ...row,
    completed: row.completed === 1,
  }
}

export function rowToTemplate(row: TemplateRow): Template {
  return {
    ...row,
    priority: row.priority as Priority,
    is_recurring: row.is_recurring === 1,
    recurrence_pattern: (row.recurrence_pattern as RecurrencePattern) ?? null,
    reminder_minutes: row.reminder_minutes ?? null,
    due_date_offset_days: row.due_date_offset_days ?? null,
    description: row.description ?? null,
    category: row.category ?? null,
    subtasks_json: row.subtasks_json ?? null,
  }
}

// ─── Progress Calculation ─────────────────────────────────────────────────────

export function calculateProgress(completed: number, total: number): number {
  if (total === 0) return 0
  return Math.round((completed / total) * 100)
}

// ─── Reminder Logic ───────────────────────────────────────────────────────────

export function isReminderDue(
  dueDate: string | null,
  reminderMinutes: number | null,
  nowISO: string
): boolean {
  if (!dueDate || !reminderMinutes) return false
  const dueTime = new Date(dueDate).getTime()
  const reminderTime = dueTime - reminderMinutes * 60 * 1000
  const now = new Date(nowISO).getTime()
  return now >= reminderTime && now < dueTime
}

// ─── CSV Helpers ──────────────────────────────────────────────────────────────

export function escapeCsvField(value: string): string {
  return `"${value.replace(/"/g, '""')}"`
}

// ─── Import Helpers ───────────────────────────────────────────────────────────

export function buildIdMap<T extends string>(
  oldIds: T[],
  generateId: () => string
): Map<T, string> {
  const idMap = new Map<T, string>()
  for (const oldId of oldIds) {
    idMap.set(oldId, generateId())
  }
  return idMap
}

export function remapRelationships(
  relationships: Array<{ todo_id: string; tag_id: string }>,
  todoIdMap: Map<string, string>,
  tagIdMap: Map<string, string>
): Array<{ newTodoId: string; newTagId: string }> {
  return relationships
    .map(rel => ({
      newTodoId: todoIdMap.get(rel.todo_id),
      newTagId: tagIdMap.get(rel.tag_id),
    }))
    .filter((rel): rel is { newTodoId: string; newTagId: string } =>
      rel.newTodoId !== undefined && rel.newTagId !== undefined
    )
}

// ─── Todo Validation ──────────────────────────────────────────────────────────

export function validateTodoTitle(title: unknown): { valid: boolean; value?: string; error?: string } {
  if (!title || typeof title !== 'string' || !title.trim()) {
    return { valid: false, error: 'Title is required' }
  }
  return { valid: true, value: title.trim() }
}

export function validateTagName(name: unknown): { valid: boolean; value?: string; error?: string } {
  if (!name || typeof name !== 'string' || !name.trim()) {
    return { valid: false, error: 'Tag name is required' }
  }
  return { valid: true, value: name.trim() }
}

export function validateRecurringFields(
  isRecurring: boolean,
  dueDate: string | null | undefined,
  pattern: unknown
): { valid: boolean; error?: string } {
  if (!isRecurring) return { valid: true }
  if (!dueDate) return { valid: false, error: 'Recurring todos require a due date' }
  if (!pattern || !VALID_PATTERNS.includes(pattern as RecurrencePattern)) {
    return { valid: false, error: 'Invalid recurrence pattern' }
  }
  return { valid: true }
}

export function validateReminderFields(
  reminderMinutes: unknown,
  dueDate: string | null | undefined
): { valid: boolean; error?: string } {
  if (reminderMinutes == null) return { valid: true }
  if (!dueDate) return { valid: false, error: 'Reminders require a due date' }
  if (!VALID_REMINDERS.includes(Number(reminderMinutes))) {
    return { valid: false, error: 'Invalid reminder value' }
  }
  return { valid: true }
}

// ─── Recurring Completion Logic ───────────────────────────────────────────────

export function shouldCreateNextRecurring(
  completedFlag: boolean,
  existingCompleted: boolean,
  isRecurring: boolean,
  dueDate: string | null,
  pattern: string | null
): boolean {
  return completedFlag === true
    && !existingCompleted
    && isRecurring
    && dueDate !== null
    && pattern !== null
}

// ─── Import Logic ─────────────────────────────────────────────────────────────

export function parseImportData(data: unknown): {
  valid: boolean
  error?: string
  importData?: {
    todos: unknown[]
    tags?: unknown[]
    subtasks?: unknown[]
    todoTags?: unknown[]
  }
} {
  if (!data || typeof data !== 'object') {
    return { valid: false, error: 'Invalid JSON format' }
  }

  const asWrapped = data as Record<string, unknown>

  if (Array.isArray(data)) {
    return { valid: true, importData: { todos: data } }
  }

  if (Array.isArray(asWrapped.todos)) {
    return {
      valid: true,
      importData: {
        todos: asWrapped.todos as unknown[],
        tags: Array.isArray(asWrapped.tags) ? asWrapped.tags as unknown[] : undefined,
        subtasks: Array.isArray(asWrapped.subtasks) ? asWrapped.subtasks as unknown[] : undefined,
        todoTags: Array.isArray(asWrapped.todoTags) ? asWrapped.todoTags as unknown[] : undefined,
      },
    }
  }

  return { valid: false, error: 'Invalid import format: todos array required' }
}

export function sanitizeImportedTodo(todo: Record<string, unknown>): {
  valid: boolean
  data?: {
    title: string
    priority: Priority
    due_date: string | null
    is_recurring: boolean
    recurrence_pattern: RecurrencePattern | null
    reminder_minutes: number | null
    completed: boolean
  }
} {
  if (!todo.title || typeof todo.title !== 'string') {
    return { valid: false }
  }

  const priority = VALID_PRIORITIES.includes(todo.priority as Priority)
    ? (todo.priority as Priority)
    : 'medium'

  const recurrencePattern = VALID_PATTERNS.includes(todo.recurrence_pattern as RecurrencePattern)
    ? (todo.recurrence_pattern as RecurrencePattern)
    : null

  return {
    valid: true,
    data: {
      title: todo.title,
      priority,
      due_date: (todo.due_date as string) ?? null,
      is_recurring: !!todo.is_recurring,
      recurrence_pattern: recurrencePattern,
      reminder_minutes: (todo.reminder_minutes as number) ?? null,
      completed: !!todo.completed,
    },
  }
}

// ─── Template Logic ───────────────────────────────────────────────────────────

export function calculateDueDateFromOffset(offsetDays: number | null, now?: Date): string | null {
  if (offsetDays == null) return null
  const date = now ? new Date(now.getTime()) : new Date()
  date.setDate(date.getDate() + offsetDays)
  return date.toISOString()
}

export function parseTemplateSubtasks(json: string | null): Array<{ title: string; position: number }> | null {
  if (!json) return null
  try {
    const parsed = JSON.parse(json)
    if (!Array.isArray(parsed)) return null
    return parsed.filter(
      (s: unknown) => typeof s === 'object' && s !== null && typeof (s as Record<string, unknown>).title === 'string'
    )
  } catch {
    return null
  }
}

// ─── CSV Export ───────────────────────────────────────────────────────────────

export const CSV_HEADERS = ['ID', 'Title', 'Completed', 'Due Date', 'Priority', 'Recurring', 'Pattern', 'Reminder', 'Created']

export function formatTodoCsvRow(todo: {
  id: string
  title: string
  completed: boolean
  due_date: string | null
  priority: string
  is_recurring: boolean
  recurrence_pattern: string | null
  reminder_minutes: number | null
  created_at: string
}): string {
  return [
    todo.id,
    `"${todo.title.replace(/"/g, '""')}"`,
    todo.completed ? 1 : 0,
    todo.due_date ?? '',
    todo.priority,
    todo.is_recurring ? 1 : 0,
    todo.recurrence_pattern ?? '',
    todo.reminder_minutes ?? '',
    todo.created_at,
  ].join(',')
}

// ─── Update Data Builder ──────────────────────────────────────────────────────

export function buildUpdateNotificationField(
  completed: unknown,
  lastNotificationSent: unknown
): { last_notification_sent?: string | null } {
  if (lastNotificationSent !== undefined) {
    return { last_notification_sent: lastNotificationSent as string | null }
  }
  if (completed !== undefined) {
    return { last_notification_sent: null }
  }
  return {}
}
