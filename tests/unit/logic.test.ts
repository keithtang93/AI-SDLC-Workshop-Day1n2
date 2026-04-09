import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import {
  calculateProgress,
  rowToTodo,
  rowToSubtask,
  rowToTemplate,
  isValidPriority,
  isValidRecurrencePattern,
  isValidReminder,
  sanitizePriority,
  sanitizeRecurrencePattern,
  isReminderDue,
  escapeCsvField,
  buildIdMap,
  remapRelationships,
  VALID_PRIORITIES,
  VALID_PATTERNS,
  VALID_REMINDERS,
  validateTodoTitle,
  validateTagName,
  validateRecurringFields,
  validateReminderFields,
  shouldCreateNextRecurring,
  parseImportData,
  sanitizeImportedTodo,
  calculateDueDateFromOffset,
  parseTemplateSubtasks,
  formatTodoCsvRow,
  CSV_HEADERS,
  buildUpdateNotificationField,
} from '../../lib/todo-utils'

// ─── Progress Calculation ─────────────────────────────────────────────────────

describe('calculateProgress', () => {
  it('should return 0 when no subtasks exist', () => {
    assert.equal(calculateProgress(0, 0), 0)
  })

  it('should return 0 when none completed', () => {
    assert.equal(calculateProgress(0, 5), 0)
  })

  it('should return 100 when all completed', () => {
    assert.equal(calculateProgress(5, 5), 100)
  })

  it('should calculate correct percentage for partial completion', () => {
    assert.equal(calculateProgress(1, 3), 33)
    assert.equal(calculateProgress(2, 3), 67)
    assert.equal(calculateProgress(1, 2), 50)
    assert.equal(calculateProgress(3, 4), 75)
  })

  it('should round to nearest integer', () => {
    assert.equal(calculateProgress(1, 6), 17)
    assert.equal(calculateProgress(5, 6), 83)
    assert.equal(calculateProgress(1, 7), 14)
    assert.equal(calculateProgress(6, 7), 86)
  })

  it('should handle single subtask', () => {
    assert.equal(calculateProgress(0, 1), 0)
    assert.equal(calculateProgress(1, 1), 100)
  })

  it('should handle large numbers', () => {
    assert.equal(calculateProgress(999, 1000), 100)
    assert.equal(calculateProgress(1, 1000), 0)
  })
})

// ─── Row Conversion Functions ─────────────────────────────────────────────────

describe('rowToTodo', () => {
  const baseTodoRow = {
    id: 'todo-1',
    user_id: 'user-1',
    title: 'Test Todo',
    description: null,
    priority: 'high',
    due_date: '2026-04-15T10:00:00.000Z',
    completed: 0,
    is_recurring: 0,
    recurrence_pattern: null,
    reminder_minutes: null,
    last_notification_sent: null,
    created_at: '2026-04-09T10:00:00.000Z',
    updated_at: '2026-04-09T10:00:00.000Z',
  }

  it('should convert completed integer 0 to boolean false', () => {
    const todo = rowToTodo({ ...baseTodoRow, completed: 0 })
    assert.equal(todo.completed, false)
  })

  it('should convert completed integer 1 to boolean true', () => {
    const todo = rowToTodo({ ...baseTodoRow, completed: 1 })
    assert.equal(todo.completed, true)
  })

  it('should convert is_recurring integer to boolean', () => {
    assert.equal(rowToTodo({ ...baseTodoRow, is_recurring: 0 }).is_recurring, false)
    assert.equal(rowToTodo({ ...baseTodoRow, is_recurring: 1 }).is_recurring, true)
  })

  it('should cast priority string to Priority type', () => {
    const todo = rowToTodo({ ...baseTodoRow, priority: 'low' })
    assert.equal(todo.priority, 'low')
  })

  it('should preserve null fields with ?? null fallback', () => {
    const todo = rowToTodo(baseTodoRow)
    assert.equal(todo.description, null)
    assert.equal(todo.recurrence_pattern, null)
    assert.equal(todo.reminder_minutes, null)
    assert.equal(todo.last_notification_sent, null)
  })

  it('should preserve non-null optional fields', () => {
    const todo = rowToTodo({
      ...baseTodoRow,
      description: 'A description',
      recurrence_pattern: 'weekly',
      reminder_minutes: 30,
      last_notification_sent: '2026-04-09T09:00:00.000Z',
    })
    assert.equal(todo.description, 'A description')
    assert.equal(todo.recurrence_pattern, 'weekly')
    assert.equal(todo.reminder_minutes, 30)
    assert.equal(todo.last_notification_sent, '2026-04-09T09:00:00.000Z')
  })

  it('should preserve id, user_id, title, and timestamps', () => {
    const todo = rowToTodo(baseTodoRow)
    assert.equal(todo.id, 'todo-1')
    assert.equal(todo.user_id, 'user-1')
    assert.equal(todo.title, 'Test Todo')
    assert.equal(todo.created_at, '2026-04-09T10:00:00.000Z')
    assert.equal(todo.updated_at, '2026-04-09T10:00:00.000Z')
  })
})

describe('rowToSubtask', () => {
  const baseSubtaskRow = {
    id: 'sub-1',
    todo_id: 'todo-1',
    title: 'Subtask A',
    completed: 0,
    position: 0,
    created_at: '2026-04-09T10:00:00.000Z',
  }

  it('should convert completed integer 0 to boolean false', () => {
    assert.equal(rowToSubtask({ ...baseSubtaskRow, completed: 0 }).completed, false)
  })

  it('should convert completed integer 1 to boolean true', () => {
    assert.equal(rowToSubtask({ ...baseSubtaskRow, completed: 1 }).completed, true)
  })

  it('should preserve all other fields unchanged', () => {
    const subtask = rowToSubtask(baseSubtaskRow)
    assert.equal(subtask.id, 'sub-1')
    assert.equal(subtask.todo_id, 'todo-1')
    assert.equal(subtask.title, 'Subtask A')
    assert.equal(subtask.position, 0)
  })
})

describe('rowToTemplate', () => {
  const baseTemplateRow = {
    id: 'tmpl-1',
    user_id: 'user-1',
    name: 'Weekly Review',
    description: null,
    category: null,
    title_template: 'Weekly Review - {date}',
    priority: 'medium',
    is_recurring: 1,
    recurrence_pattern: 'weekly',
    reminder_minutes: 60,
    due_date_offset_days: 7,
    subtasks_json: '[{"title":"Review goals","position":0}]',
    created_at: '2026-04-09T10:00:00.000Z',
    updated_at: '2026-04-09T10:00:00.000Z',
  }

  it('should convert is_recurring integer to boolean', () => {
    assert.equal(rowToTemplate({ ...baseTemplateRow, is_recurring: 1 }).is_recurring, true)
    assert.equal(rowToTemplate({ ...baseTemplateRow, is_recurring: 0 }).is_recurring, false)
  })

  it('should cast priority string to Priority type', () => {
    assert.equal(rowToTemplate({ ...baseTemplateRow, priority: 'high' }).priority, 'high')
  })

  it('should handle null optional fields', () => {
    const template = rowToTemplate({
      ...baseTemplateRow,
      description: null,
      category: null,
      recurrence_pattern: null,
      reminder_minutes: null,
      due_date_offset_days: null,
      subtasks_json: null,
    })
    assert.equal(template.description, null)
    assert.equal(template.category, null)
    assert.equal(template.recurrence_pattern, null)
    assert.equal(template.reminder_minutes, null)
    assert.equal(template.due_date_offset_days, null)
    assert.equal(template.subtasks_json, null)
  })

  it('should preserve subtasks_json as string for later parsing', () => {
    const template = rowToTemplate(baseTemplateRow)
    assert.equal(template.subtasks_json, '[{"title":"Review goals","position":0}]')
    const parsed = JSON.parse(template.subtasks_json!)
    assert.equal(parsed[0].title, 'Review goals')
    assert.equal(parsed[0].position, 0)
  })
})

// ─── Validation Functions ─────────────────────────────────────────────────────

describe('isValidPriority', () => {
  it('should accept valid priorities', () => {
    assert.ok(isValidPriority('high'))
    assert.ok(isValidPriority('medium'))
    assert.ok(isValidPriority('low'))
  })

  it('should reject invalid priorities', () => {
    assert.ok(!isValidPriority('urgent'))
    assert.ok(!isValidPriority('critical'))
    assert.ok(!isValidPriority(''))
    assert.ok(!isValidPriority('HIGH'))
    assert.ok(!isValidPriority('Medium'))
  })
})

describe('isValidRecurrencePattern', () => {
  it('should accept valid patterns', () => {
    assert.ok(isValidRecurrencePattern('daily'))
    assert.ok(isValidRecurrencePattern('weekly'))
    assert.ok(isValidRecurrencePattern('monthly'))
    assert.ok(isValidRecurrencePattern('yearly'))
  })

  it('should reject invalid patterns', () => {
    assert.ok(!isValidRecurrencePattern('biweekly'))
    assert.ok(!isValidRecurrencePattern('hourly'))
    assert.ok(!isValidRecurrencePattern(''))
    assert.ok(!isValidRecurrencePattern('DAILY'))
  })
})

describe('isValidReminder', () => {
  it('should accept all 7 valid reminder values', () => {
    for (const minutes of [15, 30, 60, 120, 1440, 2880, 10080]) {
      assert.ok(isValidReminder(minutes), `${minutes} should be valid`)
    }
  })

  it('should reject invalid reminder values', () => {
    assert.ok(!isValidReminder(0))
    assert.ok(!isValidReminder(1))
    assert.ok(!isValidReminder(45))
    assert.ok(!isValidReminder(999))
    assert.ok(!isValidReminder(-15))
    assert.ok(!isValidReminder(10081))
  })

  it('should correspond to human-readable durations', () => {
    assert.ok(isValidReminder(15))     // 15 minutes
    assert.ok(isValidReminder(30))     // 30 minutes
    assert.ok(isValidReminder(60))     // 1 hour
    assert.ok(isValidReminder(120))    // 2 hours
    assert.ok(isValidReminder(1440))   // 1 day (24 * 60)
    assert.ok(isValidReminder(2880))   // 2 days (48 * 60)
    assert.ok(isValidReminder(10080))  // 1 week (7 * 24 * 60)
  })
})

describe('sanitizePriority', () => {
  it('should return valid priority unchanged', () => {
    assert.equal(sanitizePriority('high'), 'high')
    assert.equal(sanitizePriority('medium'), 'medium')
    assert.equal(sanitizePriority('low'), 'low')
  })

  it('should default to medium for invalid values', () => {
    assert.equal(sanitizePriority('urgent'), 'medium')
    assert.equal(sanitizePriority(''), 'medium')
    assert.equal(sanitizePriority(null), 'medium')
    assert.equal(sanitizePriority(undefined), 'medium')
    assert.equal(sanitizePriority(123), 'medium')
  })
})

describe('sanitizeRecurrencePattern', () => {
  it('should return valid pattern unchanged', () => {
    assert.equal(sanitizeRecurrencePattern('daily'), 'daily')
    assert.equal(sanitizeRecurrencePattern('weekly'), 'weekly')
    assert.equal(sanitizeRecurrencePattern('monthly'), 'monthly')
    assert.equal(sanitizeRecurrencePattern('yearly'), 'yearly')
  })

  it('should return null for invalid patterns', () => {
    assert.equal(sanitizeRecurrencePattern('biweekly'), null)
    assert.equal(sanitizeRecurrencePattern(''), null)
    assert.equal(sanitizeRecurrencePattern(null), null)
    assert.equal(sanitizeRecurrencePattern(undefined), null)
    assert.equal(sanitizeRecurrencePattern(42), null)
  })
})

describe('VALID_PRIORITIES constant', () => {
  it('should contain exactly 3 priorities', () => {
    assert.equal(VALID_PRIORITIES.length, 3)
  })

  it('should match the values used in the database schema', () => {
    assert.deepEqual(VALID_PRIORITIES, ['high', 'medium', 'low'])
  })
})

describe('VALID_PATTERNS constant', () => {
  it('should contain exactly 4 patterns', () => {
    assert.equal(VALID_PATTERNS.length, 4)
  })

  it('should match the values used in the database schema', () => {
    assert.deepEqual(VALID_PATTERNS, ['daily', 'weekly', 'monthly', 'yearly'])
  })
})

describe('VALID_REMINDERS constant', () => {
  it('should contain exactly 7 reminder values', () => {
    assert.equal(VALID_REMINDERS.length, 7)
  })

  it('should be sorted in ascending order', () => {
    for (let i = 1; i < VALID_REMINDERS.length; i++) {
      assert.ok(VALID_REMINDERS[i] > VALID_REMINDERS[i - 1], `${VALID_REMINDERS[i]} should be > ${VALID_REMINDERS[i - 1]}`)
    }
  })
})

// ─── Reminder Logic ───────────────────────────────────────────────────────────

describe('isReminderDue', () => {
  it('should return false when dueDate is null', () => {
    assert.equal(isReminderDue(null, 30, '2026-04-09T10:00:00.000Z'), false)
  })

  it('should return false when reminderMinutes is null', () => {
    assert.equal(isReminderDue('2026-04-09T11:00:00.000Z', null, '2026-04-09T10:00:00.000Z'), false)
  })

  it('should return true when current time is within reminder window', () => {
    // Due at 11:00, reminder 30 min before = window is 10:30 - 11:00
    // Now is 10:45 → should be due
    assert.equal(isReminderDue('2026-04-09T11:00:00.000Z', 30, '2026-04-09T10:45:00.000Z'), true)
  })

  it('should return false when current time is before reminder window', () => {
    // Due at 11:00, reminder 30 min before = window is 10:30 - 11:00
    // Now is 10:00 → too early
    assert.equal(isReminderDue('2026-04-09T11:00:00.000Z', 30, '2026-04-09T10:00:00.000Z'), false)
  })

  it('should return false when current time is past due date', () => {
    // Due at 11:00, now is 11:30 → past due
    assert.equal(isReminderDue('2026-04-09T11:00:00.000Z', 30, '2026-04-09T11:30:00.000Z'), false)
  })

  it('should return true at exactly the reminder start time', () => {
    // Due at 11:00, reminder 60 min → window starts at 10:00
    assert.equal(isReminderDue('2026-04-09T11:00:00.000Z', 60, '2026-04-09T10:00:00.000Z'), true)
  })

  it('should return false at exactly the due time', () => {
    // Due at 11:00, now is exactly 11:00 → not < dueTime
    assert.equal(isReminderDue('2026-04-09T11:00:00.000Z', 30, '2026-04-09T11:00:00.000Z'), false)
  })

  it('should handle 1-day reminder (1440 minutes)', () => {
    // Due tomorrow at 10:00, reminder 1 day before = today 10:00
    // Now is today 15:00 → within window
    assert.equal(isReminderDue('2026-04-10T10:00:00.000Z', 1440, '2026-04-09T15:00:00.000Z'), true)
  })

  it('should handle 1-week reminder (10080 minutes)', () => {
    // Due April 16, reminder 1 week before = April 9
    assert.equal(isReminderDue('2026-04-16T10:00:00.000Z', 10080, '2026-04-09T12:00:00.000Z'), true)
    // Too early - April 8
    assert.equal(isReminderDue('2026-04-16T10:00:00.000Z', 10080, '2026-04-08T10:00:00.000Z'), false)
  })
})

// ─── CSV Helpers ──────────────────────────────────────────────────────────────

describe('escapeCsvField', () => {
  it('should wrap plain text in double quotes', () => {
    assert.equal(escapeCsvField('hello'), '"hello"')
  })

  it('should escape embedded double quotes by doubling them', () => {
    assert.equal(escapeCsvField('say "hello"'), '"say ""hello"""')
  })

  it('should handle empty string', () => {
    assert.equal(escapeCsvField(''), '""')
  })

  it('should handle text with commas', () => {
    assert.equal(escapeCsvField('buy milk, eggs'), '"buy milk, eggs"')
  })

  it('should handle text with newlines', () => {
    assert.equal(escapeCsvField('line1\nline2'), '"line1\nline2"')
  })

  it('should handle multiple double quotes', () => {
    assert.equal(escapeCsvField('a"b"c'), '"a""b""c"')
  })
})

// ─── ID Remapping (Import) ───────────────────────────────────────────────────

describe('buildIdMap', () => {
  it('should create a mapping for each old ID', () => {
    let counter = 0
    const map = buildIdMap(['a', 'b', 'c'], () => `new-${++counter}`)
    assert.equal(map.size, 3)
    assert.equal(map.get('a'), 'new-1')
    assert.equal(map.get('b'), 'new-2')
    assert.equal(map.get('c'), 'new-3')
  })

  it('should handle empty array', () => {
    const map = buildIdMap([], () => 'x')
    assert.equal(map.size, 0)
  })

  it('should use the provided generator for each ID', () => {
    const generated: string[] = []
    buildIdMap(['x', 'y'], () => {
      const id = `id-${generated.length}`
      generated.push(id)
      return id
    })
    assert.equal(generated.length, 2)
  })

  it('should handle single element', () => {
    const map = buildIdMap(['only'], () => 'mapped')
    assert.equal(map.get('only'), 'mapped')
    assert.equal(map.size, 1)
  })
})

describe('remapRelationships', () => {
  it('should remap valid todo-tag relationships', () => {
    const todoMap = new Map([['old-t1', 'new-t1'], ['old-t2', 'new-t2']])
    const tagMap = new Map([['old-g1', 'new-g1']])

    const result = remapRelationships(
      [
        { todo_id: 'old-t1', tag_id: 'old-g1' },
        { todo_id: 'old-t2', tag_id: 'old-g1' },
      ],
      todoMap,
      tagMap
    )

    assert.equal(result.length, 2)
    assert.equal(result[0].newTodoId, 'new-t1')
    assert.equal(result[0].newTagId, 'new-g1')
    assert.equal(result[1].newTodoId, 'new-t2')
    assert.equal(result[1].newTagId, 'new-g1')
  })

  it('should filter out relationships with unmapped todo IDs', () => {
    const todoMap = new Map([['old-t1', 'new-t1']])
    const tagMap = new Map([['old-g1', 'new-g1']])

    const result = remapRelationships(
      [
        { todo_id: 'old-t1', tag_id: 'old-g1' },
        { todo_id: 'missing', tag_id: 'old-g1' },
      ],
      todoMap,
      tagMap
    )

    assert.equal(result.length, 1)
    assert.equal(result[0].newTodoId, 'new-t1')
  })

  it('should filter out relationships with unmapped tag IDs', () => {
    const todoMap = new Map([['old-t1', 'new-t1']])
    const tagMap = new Map([['old-g1', 'new-g1']])

    const result = remapRelationships(
      [
        { todo_id: 'old-t1', tag_id: 'old-g1' },
        { todo_id: 'old-t1', tag_id: 'missing' },
      ],
      todoMap,
      tagMap
    )

    assert.equal(result.length, 1)
  })

  it('should return empty array when no relationships match', () => {
    const todoMap = new Map<string, string>()
    const tagMap = new Map<string, string>()

    const result = remapRelationships(
      [{ todo_id: 'a', tag_id: 'b' }],
      todoMap,
      tagMap
    )

    assert.equal(result.length, 0)
  })

  it('should handle empty input array', () => {
    const todoMap = new Map([['x', 'y']])
    const tagMap = new Map([['a', 'b']])
    const result = remapRelationships([], todoMap, tagMap)
    assert.equal(result.length, 0)
  })
})

// ─── Todo Title Validation ────────────────────────────────────────────────────

describe('validateTodoTitle', () => {
  it('should accept a valid non-empty string', () => {
    const result = validateTodoTitle('Buy groceries')
    assert.equal(result.valid, true)
    assert.equal(result.value, 'Buy groceries')
  })

  it('should trim whitespace from valid title', () => {
    const result = validateTodoTitle('  Buy groceries  ')
    assert.equal(result.valid, true)
    assert.equal(result.value, 'Buy groceries')
  })

  it('should reject empty string', () => {
    const result = validateTodoTitle('')
    assert.equal(result.valid, false)
    assert.equal(result.error, 'Title is required')
  })

  it('should reject whitespace-only string', () => {
    const result = validateTodoTitle('   ')
    assert.equal(result.valid, false)
    assert.equal(result.error, 'Title is required')
  })

  it('should reject null', () => {
    const result = validateTodoTitle(null)
    assert.equal(result.valid, false)
  })

  it('should reject undefined', () => {
    const result = validateTodoTitle(undefined)
    assert.equal(result.valid, false)
  })

  it('should reject number', () => {
    const result = validateTodoTitle(42)
    assert.equal(result.valid, false)
  })

  it('should reject boolean', () => {
    const result = validateTodoTitle(true)
    assert.equal(result.valid, false)
  })

  it('should accept single character', () => {
    const result = validateTodoTitle('A')
    assert.equal(result.valid, true)
    assert.equal(result.value, 'A')
  })
})

// ─── Tag Name Validation ──────────────────────────────────────────────────────

describe('validateTagName', () => {
  it('should accept a valid tag name', () => {
    const result = validateTagName('Work')
    assert.equal(result.valid, true)
    assert.equal(result.value, 'Work')
  })

  it('should trim whitespace from tag name', () => {
    const result = validateTagName('  Work  ')
    assert.equal(result.valid, true)
    assert.equal(result.value, 'Work')
  })

  it('should reject empty string', () => {
    const result = validateTagName('')
    assert.equal(result.valid, false)
    assert.equal(result.error, 'Tag name is required')
  })

  it('should reject whitespace-only string', () => {
    const result = validateTagName('   ')
    assert.equal(result.valid, false)
  })

  it('should reject null', () => {
    const result = validateTagName(null)
    assert.equal(result.valid, false)
  })

  it('should reject non-string types', () => {
    assert.equal(validateTagName(123).valid, false)
    assert.equal(validateTagName(true).valid, false)
    assert.equal(validateTagName({}).valid, false)
  })
})

// ─── Recurring Field Validation ───────────────────────────────────────────────

describe('validateRecurringFields', () => {
  it('should pass when isRecurring is false', () => {
    const result = validateRecurringFields(false, null, null)
    assert.equal(result.valid, true)
  })

  it('should pass when recurring with valid due date and pattern', () => {
    const result = validateRecurringFields(true, '2026-04-15T10:00:00.000Z', 'daily')
    assert.equal(result.valid, true)
  })

  it('should fail when recurring without due date', () => {
    const result = validateRecurringFields(true, null, 'daily')
    assert.equal(result.valid, false)
    assert.equal(result.error, 'Recurring todos require a due date')
  })

  it('should fail when recurring with undefined due date', () => {
    const result = validateRecurringFields(true, undefined, 'weekly')
    assert.equal(result.valid, false)
  })

  it('should fail when recurring without pattern', () => {
    const result = validateRecurringFields(true, '2026-04-15T10:00:00.000Z', null)
    assert.equal(result.valid, false)
    assert.equal(result.error, 'Invalid recurrence pattern')
  })

  it('should fail when recurring with invalid pattern', () => {
    const result = validateRecurringFields(true, '2026-04-15T10:00:00.000Z', 'biweekly')
    assert.equal(result.valid, false)
    assert.equal(result.error, 'Invalid recurrence pattern')
  })

  it('should accept all valid patterns when recurring', () => {
    for (const pattern of ['daily', 'weekly', 'monthly', 'yearly']) {
      const result = validateRecurringFields(true, '2026-04-15T10:00:00.000Z', pattern)
      assert.equal(result.valid, true, `Pattern '${pattern}' should be valid`)
    }
  })

  it('should fail when recurring with empty string pattern', () => {
    const result = validateRecurringFields(true, '2026-04-15T10:00:00.000Z', '')
    assert.equal(result.valid, false)
  })
})

// ─── Reminder Field Validation ────────────────────────────────────────────────

describe('validateReminderFields', () => {
  it('should pass when reminderMinutes is null', () => {
    const result = validateReminderFields(null, null)
    assert.equal(result.valid, true)
  })

  it('should pass when reminderMinutes is undefined', () => {
    const result = validateReminderFields(undefined, null)
    assert.equal(result.valid, true)
  })

  it('should pass with valid reminder and due date', () => {
    const result = validateReminderFields(30, '2026-04-15T10:00:00.000Z')
    assert.equal(result.valid, true)
  })

  it('should fail when reminder set without due date', () => {
    const result = validateReminderFields(30, null)
    assert.equal(result.valid, false)
    assert.equal(result.error, 'Reminders require a due date')
  })

  it('should fail when reminder set with undefined due date', () => {
    const result = validateReminderFields(60, undefined)
    assert.equal(result.valid, false)
  })

  it('should fail with invalid reminder value', () => {
    const result = validateReminderFields(45, '2026-04-15T10:00:00.000Z')
    assert.equal(result.valid, false)
    assert.equal(result.error, 'Invalid reminder value')
  })

  it('should accept all 7 valid reminder values with due date', () => {
    for (const minutes of [15, 30, 60, 120, 1440, 2880, 10080]) {
      const result = validateReminderFields(minutes, '2026-04-15T10:00:00.000Z')
      assert.equal(result.valid, true, `${minutes} should be valid`)
    }
  })

  it('should accept string numbers via Number() coercion', () => {
    const result = validateReminderFields('30', '2026-04-15T10:00:00.000Z')
    assert.equal(result.valid, true)
  })

  it('should reject zero as reminder (not in VALID_REMINDERS)', () => {
    const result = validateReminderFields(0, '2026-04-15T10:00:00.000Z')
    assert.equal(result.valid, false) // 0 != null is true, so validation runs and rejects it
  })
})

// ─── Recurring Completion Logic ───────────────────────────────────────────────

describe('shouldCreateNextRecurring', () => {
  it('should return true when completing a recurring todo', () => {
    assert.equal(shouldCreateNextRecurring(true, false, true, '2026-04-15T10:00:00.000Z', 'daily'), true)
  })

  it('should return false when not completing (completed=false)', () => {
    assert.equal(shouldCreateNextRecurring(false, false, true, '2026-04-15T10:00:00.000Z', 'daily'), false)
  })

  it('should return false when already completed', () => {
    assert.equal(shouldCreateNextRecurring(true, true, true, '2026-04-15T10:00:00.000Z', 'daily'), false)
  })

  it('should return false when not recurring', () => {
    assert.equal(shouldCreateNextRecurring(true, false, false, '2026-04-15T10:00:00.000Z', 'daily'), false)
  })

  it('should return false when no due date', () => {
    assert.equal(shouldCreateNextRecurring(true, false, true, null, 'daily'), false)
  })

  it('should return false when no pattern', () => {
    assert.equal(shouldCreateNextRecurring(true, false, true, '2026-04-15T10:00:00.000Z', null), false)
  })

  it('should return true for all valid patterns', () => {
    for (const pattern of ['daily', 'weekly', 'monthly', 'yearly']) {
      assert.equal(
        shouldCreateNextRecurring(true, false, true, '2026-04-15T10:00:00.000Z', pattern),
        true,
        `Pattern '${pattern}' should trigger next recurring`
      )
    }
  })
})

// ─── Import Data Parsing ──────────────────────────────────────────────────────

describe('parseImportData', () => {
  it('should accept wrapped format with todos array', () => {
    const result = parseImportData({ todos: [{ title: 'Test' }] })
    assert.equal(result.valid, true)
    assert.equal(result.importData!.todos.length, 1)
  })

  it('should accept raw array format', () => {
    const result = parseImportData([{ title: 'Test' }])
    assert.equal(result.valid, true)
    assert.equal(result.importData!.todos.length, 1)
  })

  it('should include optional tags, subtasks, todoTags from wrapped format', () => {
    const result = parseImportData({
      todos: [{ title: 'A' }],
      tags: [{ name: 'Tag1' }],
      subtasks: [{ title: 'Sub1' }],
      todoTags: [{ todo_id: 'a', tag_id: 'b' }],
    })
    assert.equal(result.valid, true)
    assert.equal(result.importData!.tags!.length, 1)
    assert.equal(result.importData!.subtasks!.length, 1)
    assert.equal(result.importData!.todoTags!.length, 1)
  })

  it('should reject null', () => {
    const result = parseImportData(null)
    assert.equal(result.valid, false)
    assert.equal(result.error, 'Invalid JSON format')
  })

  it('should reject undefined', () => {
    const result = parseImportData(undefined)
    assert.equal(result.valid, false)
  })

  it('should reject string', () => {
    const result = parseImportData('not json')
    assert.equal(result.valid, false)
  })

  it('should reject object without todos array', () => {
    const result = parseImportData({ items: [] })
    assert.equal(result.valid, false)
    assert.equal(result.error, 'Invalid import format: todos array required')
  })

  it('should reject object with todos as non-array', () => {
    const result = parseImportData({ todos: 'not an array' })
    assert.equal(result.valid, false)
  })

  it('should handle empty todos array', () => {
    const result = parseImportData({ todos: [] })
    assert.equal(result.valid, true)
    assert.equal(result.importData!.todos.length, 0)
  })

  it('should omit non-array optional fields', () => {
    const result = parseImportData({ todos: [], tags: 'not array', subtasks: 42 })
    assert.equal(result.valid, true)
    assert.equal(result.importData!.tags, undefined)
    assert.equal(result.importData!.subtasks, undefined)
  })
})

// ─── Import Todo Sanitization ─────────────────────────────────────────────────

describe('sanitizeImportedTodo', () => {
  it('should accept valid todo with all fields', () => {
    const result = sanitizeImportedTodo({
      title: 'Test todo',
      priority: 'high',
      due_date: '2026-04-15T10:00:00.000Z',
      is_recurring: true,
      recurrence_pattern: 'daily',
      reminder_minutes: 30,
      completed: false,
    })
    assert.equal(result.valid, true)
    assert.equal(result.data!.title, 'Test todo')
    assert.equal(result.data!.priority, 'high')
    assert.equal(result.data!.is_recurring, true)
    assert.equal(result.data!.recurrence_pattern, 'daily')
    assert.equal(result.data!.reminder_minutes, 30)
  })

  it('should default priority to medium for invalid values', () => {
    const result = sanitizeImportedTodo({ title: 'Test', priority: 'urgent' })
    assert.equal(result.valid, true)
    assert.equal(result.data!.priority, 'medium')
  })

  it('should default priority to medium when missing', () => {
    const result = sanitizeImportedTodo({ title: 'Test' })
    assert.equal(result.valid, true)
    assert.equal(result.data!.priority, 'medium')
  })

  it('should nullify invalid recurrence pattern', () => {
    const result = sanitizeImportedTodo({ title: 'Test', recurrence_pattern: 'biweekly' })
    assert.equal(result.valid, true)
    assert.equal(result.data!.recurrence_pattern, null)
  })

  it('should reject todo without title', () => {
    const result = sanitizeImportedTodo({ priority: 'high' })
    assert.equal(result.valid, false)
  })

  it('should reject todo with non-string title', () => {
    const result = sanitizeImportedTodo({ title: 42 })
    assert.equal(result.valid, false)
  })

  it('should reject empty string title', () => {
    const result = sanitizeImportedTodo({ title: '' })
    assert.equal(result.valid, false)
  })

  it('should handle missing optional fields with null defaults', () => {
    const result = sanitizeImportedTodo({ title: 'Test' })
    assert.equal(result.valid, true)
    assert.equal(result.data!.due_date, null)
    assert.equal(result.data!.is_recurring, false)
    assert.equal(result.data!.recurrence_pattern, null)
    assert.equal(result.data!.reminder_minutes, null)
    assert.equal(result.data!.completed, false)
  })

  it('should preserve completed=true', () => {
    const result = sanitizeImportedTodo({ title: 'Done', completed: true })
    assert.equal(result.data!.completed, true)
  })

  it('should accept all valid priorities', () => {
    for (const p of ['high', 'medium', 'low']) {
      const result = sanitizeImportedTodo({ title: 'T', priority: p })
      assert.equal(result.data!.priority, p, `Priority '${p}' should be preserved`)
    }
  })

  it('should accept all valid recurrence patterns', () => {
    for (const p of ['daily', 'weekly', 'monthly', 'yearly']) {
      const result = sanitizeImportedTodo({ title: 'T', recurrence_pattern: p })
      assert.equal(result.data!.recurrence_pattern, p, `Pattern '${p}' should be preserved`)
    }
  })
})

// ─── Template Due Date Offset ─────────────────────────────────────────────────

describe('calculateDueDateFromOffset', () => {
  const baseDate = new Date('2026-04-09T10:00:00.000Z')

  it('should return null when offset is null', () => {
    assert.equal(calculateDueDateFromOffset(null), null)
  })

  it('should return null when offset is undefined', () => {
    assert.equal(calculateDueDateFromOffset(undefined as unknown as number | null), null)
  })

  it('should add positive offset days', () => {
    const result = calculateDueDateFromOffset(7, baseDate)
    const date = new Date(result!)
    assert.equal(date.getUTCDate(), 16) // April 9 + 7 = April 16
    assert.equal(date.getUTCMonth(), 3) // April
  })

  it('should handle 0 offset (due today)', () => {
    const result = calculateDueDateFromOffset(0, baseDate)
    const date = new Date(result!)
    assert.equal(date.getUTCDate(), 9)
  })

  it('should handle negative offset (past dates)', () => {
    const result = calculateDueDateFromOffset(-3, baseDate)
    const date = new Date(result!)
    assert.equal(date.getUTCDate(), 6) // April 9 - 3 = April 6
  })

  it('should handle large offsets crossing months', () => {
    const result = calculateDueDateFromOffset(30, baseDate)
    const date = new Date(result!)
    assert.equal(date.getUTCMonth(), 4) // May
    assert.equal(date.getUTCDate(), 9)
  })

  it('should return valid ISO string', () => {
    const result = calculateDueDateFromOffset(1, baseDate)
    assert.ok(result!.endsWith('Z'))
    assert.ok(!isNaN(new Date(result!).getTime()))
  })
})

// ─── Template Subtasks Parsing ────────────────────────────────────────────────

describe('parseTemplateSubtasks', () => {
  it('should return null for null input', () => {
    assert.equal(parseTemplateSubtasks(null), null)
  })

  it('should return null for empty string', () => {
    assert.equal(parseTemplateSubtasks(''), null)
  })

  it('should parse valid subtasks JSON', () => {
    const json = '[{"title":"Step 1","position":0},{"title":"Step 2","position":1}]'
    const result = parseTemplateSubtasks(json)
    assert.equal(result!.length, 2)
    assert.equal(result![0].title, 'Step 1')
    assert.equal(result![0].position, 0)
    assert.equal(result![1].title, 'Step 2')
  })

  it('should return null for invalid JSON', () => {
    const result = parseTemplateSubtasks('not json {{{')
    assert.equal(result, null)
  })

  it('should return null when parsed value is not an array', () => {
    const result = parseTemplateSubtasks('{"title":"not array"}')
    assert.equal(result, null)
  })

  it('should filter out entries without title', () => {
    const json = '[{"title":"Valid","position":0},{"position":1},{"title":"Also Valid","position":2}]'
    const result = parseTemplateSubtasks(json)
    assert.equal(result!.length, 2)
    assert.equal(result![0].title, 'Valid')
    assert.equal(result![1].title, 'Also Valid')
  })

  it('should filter out entries with non-string title', () => {
    const json = '[{"title":"Valid","position":0},{"title":42,"position":1}]'
    const result = parseTemplateSubtasks(json)
    assert.equal(result!.length, 1)
    assert.equal(result![0].title, 'Valid')
  })

  it('should handle empty array', () => {
    const result = parseTemplateSubtasks('[]')
    assert.equal(result!.length, 0)
  })

  it('should filter out null entries', () => {
    const json = '[null,{"title":"Valid","position":0}]'
    const result = parseTemplateSubtasks(json)
    assert.equal(result!.length, 1)
  })
})

// ─── CSV Row Formatting ──────────────────────────────────────────────────────

describe('formatTodoCsvRow', () => {
  const baseTodo = {
    id: 'todo-1',
    title: 'Test Todo',
    completed: false,
    due_date: '2026-04-15T10:00:00.000Z',
    priority: 'medium',
    is_recurring: false,
    recurrence_pattern: null,
    reminder_minutes: null,
    created_at: '2026-04-09T10:00:00.000Z',
  }

  it('should generate correct CSV row for basic todo', () => {
    const row = formatTodoCsvRow(baseTodo)
    const fields = row.split(',')
    assert.equal(fields[0], 'todo-1')
    assert.equal(fields[1], '"Test Todo"')
    assert.equal(fields[2], '0') // not completed
    assert.equal(fields[3], '2026-04-15T10:00:00.000Z')
    assert.equal(fields[4], 'medium')
    assert.equal(fields[5], '0') // not recurring
  })

  it('should output 1 for completed todo', () => {
    const row = formatTodoCsvRow({ ...baseTodo, completed: true })
    assert.ok(row.includes(',1,')) // completed = 1
  })

  it('should output 1 for recurring todo', () => {
    const row = formatTodoCsvRow({ ...baseTodo, is_recurring: true, recurrence_pattern: 'daily' })
    const fields = row.split(',')
    assert.equal(fields[5], '1')
    assert.equal(fields[6], 'daily')
  })

  it('should escape double quotes in title', () => {
    const row = formatTodoCsvRow({ ...baseTodo, title: 'Say "hello"' })
    assert.ok(row.includes('"Say ""hello"""'))
  })

  it('should handle null due_date as empty string', () => {
    const row = formatTodoCsvRow({ ...baseTodo, due_date: null })
    const fields = row.split(',')
    assert.equal(fields[3], '')
  })

  it('should handle null recurrence_pattern as empty string', () => {
    const row = formatTodoCsvRow(baseTodo)
    const fields = row.split(',')
    assert.equal(fields[6], '')
  })

  it('should handle null reminder_minutes as empty string', () => {
    const row = formatTodoCsvRow(baseTodo)
    const fields = row.split(',')
    assert.equal(fields[7], '')
  })

  it('should include reminder_minutes when set', () => {
    const row = formatTodoCsvRow({ ...baseTodo, reminder_minutes: 60 })
    const fields = row.split(',')
    assert.equal(fields[7], '60')
  })
})

describe('CSV_HEADERS', () => {
  it('should contain exactly 9 headers', () => {
    assert.equal(CSV_HEADERS.length, 9)
  })

  it('should match expected column order', () => {
    assert.deepEqual(CSV_HEADERS, ['ID', 'Title', 'Completed', 'Due Date', 'Priority', 'Recurring', 'Pattern', 'Reminder', 'Created'])
  })
})

// ─── Notification Field Builder ───────────────────────────────────────────────

describe('buildUpdateNotificationField', () => {
  it('should use explicit lastNotificationSent when provided', () => {
    const result = buildUpdateNotificationField(true, '2026-04-09T10:00:00.000Z')
    assert.equal(result.last_notification_sent, '2026-04-09T10:00:00.000Z')
  })

  it('should set null when lastNotificationSent is explicitly null', () => {
    const result = buildUpdateNotificationField(true, null)
    assert.equal(result.last_notification_sent, null)
  })

  it('should reset to null when completed changes but no lastNotificationSent', () => {
    const result = buildUpdateNotificationField(true, undefined)
    assert.equal(result.last_notification_sent, null)
  })

  it('should return empty when neither completed nor lastNotificationSent provided', () => {
    const result = buildUpdateNotificationField(undefined, undefined)
    assert.equal(Object.keys(result).length, 0)
  })

  it('should reset to null when completed is false (toggling back)', () => {
    const result = buildUpdateNotificationField(false, undefined)
    assert.equal(result.last_notification_sent, null)
  })
})
