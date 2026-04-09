'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useNotifications } from '@/lib/hooks/useNotifications'
import { getReminderLabel } from '@/lib/timezone'

// ========== Types ==========
interface Subtask {
  id: number
  todo_id: number
  title: string
  completed: boolean
  position: number
}

interface Tag {
  id: number
  user_id: number
  name: string
  color: string
}

interface Todo {
  id: number
  user_id: number
  title: string
  completed: boolean
  priority: string
  due_date: string | null
  is_recurring: boolean
  recurrence_pattern: string | null
  reminder_minutes: number | null
  last_notification_sent: string | null
  created_at: string
  updated_at: string
  subtasks: Subtask[]
  tags: Tag[]
}

interface User {
  id: number
  username: string
}

interface Template {
  id: number
  user_id: number
  name: string
  description: string | null
  category: string | null
  title_template: string
  priority: string
  is_recurring: boolean
  recurrence_pattern: string | null
  reminder_minutes: number | null
  subtasks: Array<{ title: string }>
  created_at: string
  updated_at: string
}

const RECURRENCE_PATTERNS = ['daily', 'weekly', 'monthly', 'yearly'] as const
const REMINDER_OPTIONS = [
  { value: 0, label: 'None' },
  { value: 15, label: '15 minutes before' },
  { value: 30, label: '30 minutes before' },
  { value: 60, label: '1 hour before' },
  { value: 120, label: '2 hours before' },
  { value: 1440, label: '1 day before' },
  { value: 2880, label: '2 days before' },
  { value: 10080, label: '1 week before' },
] as const

const PRIORITY_COLORS: Record<string, { bg: string; text: string; darkBg: string; darkText: string }> = {
  high: { bg: 'bg-red-100', text: 'text-red-800', darkBg: 'dark:bg-red-900/40', darkText: 'dark:text-red-300' },
  medium: { bg: 'bg-amber-100', text: 'text-amber-800', darkBg: 'dark:bg-amber-900/40', darkText: 'dark:text-amber-300' },
  low: { bg: 'bg-blue-100', text: 'text-blue-800', darkBg: 'dark:bg-blue-900/40', darkText: 'dark:text-blue-300' },
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleString('en-SG', {
    timeZone: 'Asia/Singapore',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  })
}

function isOverdue(todo: Todo): boolean {
  if (!todo.due_date || todo.completed) return false
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Singapore' }))
  return new Date(todo.due_date) < now
}

// ========== Main Component ==========
export default function HomePage() {
  const [user, setUser] = useState<User | null>(null)
  const [todos, setTodos] = useState<Todo[]>([])
  const [tags, setTags] = useState<Tag[]>([])
  const [loading, setLoading] = useState(true)
  const [darkMode, setDarkMode] = useState(false)

  // Search state
  const [searchQuery, setSearchQuery] = useState('')
  const [searchDebounced, setSearchDebounced] = useState('')
  const [filterCompleted, setFilterCompleted] = useState<'all' | 'active' | 'completed'>('all')
  const [filterDateFrom, setFilterDateFrom] = useState('')
  const [filterDateTo, setFilterDateTo] = useState('')
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false)

  // Template state
  const [templates, setTemplates] = useState<Template[]>([])
  const [showTemplateManager, setShowTemplateManager] = useState(false)
  const [showSaveTemplate, setShowSaveTemplate] = useState(false)
  const [templateName, setTemplateName] = useState('')
  const [templateDescription, setTemplateDescription] = useState('')
  const [templateCategory, setTemplateCategory] = useState('')
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null)
  const [templateFilterCategory, setTemplateFilterCategory] = useState<string>('all')

  // Delete confirmation state
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<number | null>(null)

  // Export/Import state
  const [importStatus, setImportStatus] = useState<string>('')

  // Form state
  const [formTitle, setFormTitle] = useState('')
  const [formPriority, setFormPriority] = useState<string>('medium')
  const [formDueDate, setFormDueDate] = useState('')
  const [formIsRecurring, setFormIsRecurring] = useState(false)
  const [formRecurrencePattern, setFormRecurrencePattern] = useState<string>('daily')
  const [formReminderMinutes, setFormReminderMinutes] = useState<number>(0)
  const [formSelectedTags, setFormSelectedTags] = useState<number[]>([])

  // Edit state
  const [editingTodo, setEditingTodo] = useState<Todo | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editPriority, setEditPriority] = useState<string>('medium')
  const [editDueDate, setEditDueDate] = useState('')
  const [editIsRecurring, setEditIsRecurring] = useState(false)
  const [editRecurrencePattern, setEditRecurrencePattern] = useState<string>('daily')
  const [editReminderMinutes, setEditReminderMinutes] = useState<number>(0)

  // UI state
  const [expandedTodos, setExpandedTodos] = useState<Set<number>>(new Set())
  const [subtaskInputs, setSubtaskInputs] = useState<Record<number, string>>({})
  const [showTagManager, setShowTagManager] = useState(false)
  const [tagName, setTagName] = useState('')
  const [tagColor, setTagColor] = useState('#3B82F6')
  const [editingTag, setEditingTag] = useState<Tag | null>(null)
  const [showCompleted, setShowCompleted] = useState(true)
  const [formError, setFormError] = useState('')

  // Filters
  const [filterPriority, setFilterPriority] = useState<string>('all')
  const [filterTag, setFilterTag] = useState<number | 'all'>('all')

  const { permission, requestPermission } = useNotifications()

  // ========== Dark mode ==========
  useEffect(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem('darkMode') : null
    if (saved === 'true') {
      setDarkMode(true)
      document.documentElement.classList.add('dark')
    }
  }, [])

  const toggleDarkMode = useCallback(() => {
    setDarkMode(prev => {
      const next = !prev
      if (next) {
        document.documentElement.classList.add('dark')
      } else {
        document.documentElement.classList.remove('dark')
      }
      localStorage.setItem('darkMode', String(next))
      return next
    })
  }, [])

  // ========== Data fetching ==========
  const fetchTodos = useCallback(async () => {
    try {
      const res = await fetch('/api/todos')
      if (res.ok) {
        const data = await res.json()
        setTodos(data)
      }
    } catch { /* noop */ }
  }, [])

  const fetchTags = useCallback(async () => {
    try {
      const res = await fetch('/api/tags')
      if (res.ok) {
        const data = await res.json()
        setTags(data)
      }
    } catch { /* noop */ }
  }, [])

  const fetchTemplates = useCallback(async () => {
    try {
      const res = await fetch('/api/templates')
      if (res.ok) {
        const data = await res.json()
        setTemplates(data)
      }
    } catch { /* noop */ }
  }, [])

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => setSearchDebounced(searchQuery), 300)
    return () => clearTimeout(timer)
  }, [searchQuery])

  useEffect(() => {
    async function init() {
      try {
        const res = await fetch('/api/auth/me')
        if (res.ok) {
          const data = await res.json()
          setUser(data)
          await Promise.all([fetchTodos(), fetchTags(), fetchTemplates()])
        }
      } catch { /* noop */ }
      setLoading(false)
    }
    init()
  }, [fetchTodos, fetchTags, fetchTemplates])

  // ========== Todo CRUD ==========
  async function handleCreateTodo(e: React.FormEvent) {
    e.preventDefault()
    setFormError('')

    if (!formTitle.trim()) {
      setFormError('Title is required')
      return
    }

    const payload: Record<string, unknown> = {
      title: formTitle.trim(),
      priority: formPriority,
    }

    if (formDueDate) {
      payload.due_date = new Date(formDueDate).toISOString()
    }

    if (formIsRecurring && formDueDate) {
      payload.is_recurring = true
      payload.recurrence_pattern = formRecurrencePattern
    }

    if (formReminderMinutes > 0 && formDueDate) {
      payload.reminder_minutes = formReminderMinutes
    }

    try {
      const res = await fetch('/api/todos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const data = await res.json()
        setFormError(data.error || 'Failed to create todo')
        return
      }

      const newTodo = await res.json()

      // Assign tags
      for (const tagId of formSelectedTags) {
        await fetch(`/api/todos/${newTodo.id}/tags`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tagId }),
        })
      }

      resetForm()
      await fetchTodos()
    } catch {
      setFormError('Failed to create todo')
    }
  }

  function resetForm() {
    setFormTitle('')
    setFormPriority('medium')
    setFormDueDate('')
    setFormIsRecurring(false)
    setFormRecurrencePattern('daily')
    setFormReminderMinutes(0)
    setFormSelectedTags([])
    setFormError('')
  }

  async function handleToggleComplete(todo: Todo) {
    const previousTodos = todos
    setTodos(prev => prev.map(t => t.id === todo.id ? { ...t, completed: !t.completed } : t))
    try {
      const res = await fetch(`/api/todos/${todo.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ completed: !todo.completed }),
      })
      if (res.ok) {
        await fetchTodos()
      } else {
        setTodos(previousTodos)
      }
    } catch {
      setTodos(previousTodos)
    }
  }

  function handleDeleteTodo(id: number) {
    setConfirmingDeleteId(id)
  }

  async function confirmDelete() {
    const id = confirmingDeleteId
    if (id === null) return
    setConfirmingDeleteId(null)
    const previousTodos = todos
    setTodos(prev => prev.filter(t => t.id !== id))
    if (editingTodo?.id === id) setEditingTodo(null)
    try {
      const res = await fetch(`/api/todos/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        setTodos(previousTodos)
      }
    } catch {
      setTodos(previousTodos)
    }
  }

  function startEditing(todo: Todo) {
    setEditingTodo(todo)
    setEditTitle(todo.title)
    setEditPriority(todo.priority)
    setEditDueDate(todo.due_date ? new Date(todo.due_date).toISOString().slice(0, 16) : '')
    setEditIsRecurring(todo.is_recurring)
    setEditRecurrencePattern(todo.recurrence_pattern || 'daily')
    setEditReminderMinutes(todo.reminder_minutes || 0)
  }

  async function handleSaveEdit() {
    if (!editingTodo) return
    if (!editTitle.trim()) return

    const payload: Record<string, unknown> = {
      title: editTitle.trim(),
      priority: editPriority,
    }

    if (editDueDate) {
      payload.due_date = new Date(editDueDate).toISOString()
    } else {
      payload.due_date = null
    }

    payload.is_recurring = editIsRecurring && !!editDueDate
    payload.recurrence_pattern = editIsRecurring && editDueDate ? editRecurrencePattern : null
    payload.reminder_minutes = editReminderMinutes > 0 && editDueDate ? editReminderMinutes : null

    try {
      const res = await fetch(`/api/todos/${editingTodo.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (res.ok) {
        setEditingTodo(null)
        await fetchTodos()
      }
    } catch { /* noop */ }
  }

  // ========== Subtasks ==========
  async function handleAddSubtask(todoId: number) {
    const title = subtaskInputs[todoId]?.trim()
    if (!title) return

    try {
      const res = await fetch(`/api/todos/${todoId}/subtasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title }),
      })
      if (res.ok) {
        setSubtaskInputs(prev => ({ ...prev, [todoId]: '' }))
        await fetchTodos()
      }
    } catch { /* noop */ }
  }

  async function handleToggleSubtask(subtask: Subtask) {
    try {
      const res = await fetch(`/api/subtasks/${subtask.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ completed: !subtask.completed }),
      })
      if (res.ok) await fetchTodos()
    } catch { /* noop */ }
  }

  async function handleDeleteSubtask(subtaskId: number) {
    try {
      const res = await fetch(`/api/subtasks/${subtaskId}`, { method: 'DELETE' })
      if (res.ok) await fetchTodos()
    } catch { /* noop */ }
  }

  // ========== Tags ==========
  async function handleCreateTag() {
    if (!tagName.trim()) return

    try {
      const res = await fetch('/api/tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: tagName.trim(), color: tagColor }),
      })
      if (res.ok) {
        setTagName('')
        setTagColor('#3B82F6')
        await fetchTags()
      }
    } catch { /* noop */ }
  }

  async function handleUpdateTag() {
    if (!editingTag || !tagName.trim()) return

    try {
      const res = await fetch(`/api/tags/${editingTag.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: tagName.trim(), color: tagColor }),
      })
      if (res.ok) {
        setEditingTag(null)
        setTagName('')
        setTagColor('#3B82F6')
        await Promise.all([fetchTags(), fetchTodos()])
      }
    } catch { /* noop */ }
  }

  async function handleDeleteTag(tagId: number) {
    try {
      const res = await fetch(`/api/tags/${tagId}`, { method: 'DELETE' })
      if (res.ok) {
        await Promise.all([fetchTags(), fetchTodos()])
      }
    } catch { /* noop */ }
  }

  async function handleToggleTodoTag(todoId: number, tagId: number, assigned: boolean) {
    try {
      if (assigned) {
        await fetch(`/api/todos/${todoId}/tags`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tagId }),
        })
      } else {
        await fetch(`/api/todos/${todoId}/tags`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tagId }),
        })
      }
      await fetchTodos()
    } catch { /* noop */ }
  }

  // ========== Logout ==========
  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    window.location.href = '/login'
  }

  // ========== Templates ==========
  async function handleSaveAsTemplate() {
    if (!templateName.trim()) return

    const subtasksArr = editingTodo?.subtasks?.map(s => ({ title: s.title })) || []

    const payload: Record<string, unknown> = {
      name: templateName.trim(),
      description: templateDescription.trim() || null,
      category: templateCategory.trim() || null,
      title_template: editingTodo?.title || formTitle || 'Untitled',
      priority: editingTodo?.priority || formPriority,
      is_recurring: editingTodo?.is_recurring || formIsRecurring,
      recurrence_pattern: editingTodo?.recurrence_pattern || (formIsRecurring ? formRecurrencePattern : null),
      reminder_minutes: editingTodo?.reminder_minutes || (formReminderMinutes > 0 ? formReminderMinutes : null),
      subtasks_json: subtasksArr.length > 0 ? JSON.stringify(subtasksArr) : null,
    }

    try {
      const res = await fetch('/api/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (res.ok) {
        setShowSaveTemplate(false)
        setTemplateName('')
        setTemplateDescription('')
        setTemplateCategory('')
        await fetchTemplates()
      }
    } catch { /* noop */ }
  }

  async function handleUseTemplate(template: Template) {
    try {
      const res = await fetch(`/api/templates/${template.id}/use`, { method: 'POST' })
      if (res.ok) {
        setShowTemplateManager(false)
        await fetchTodos()
      }
    } catch { /* noop */ }
  }

  async function handleDeleteTemplate(id: number) {
    try {
      const res = await fetch(`/api/templates/${id}`, { method: 'DELETE' })
      if (res.ok) await fetchTemplates()
    } catch { /* noop */ }
  }

  async function handleUpdateTemplate() {
    if (!editingTemplate || !templateName.trim()) return
    try {
      const res = await fetch(`/api/templates/${editingTemplate.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: templateName.trim(),
          description: templateDescription.trim() || null,
          category: templateCategory.trim() || null,
        }),
      })
      if (res.ok) {
        setEditingTemplate(null)
        setTemplateName('')
        setTemplateDescription('')
        setTemplateCategory('')
        await fetchTemplates()
      }
    } catch { /* noop */ }
  }

  // ========== Export / Import ==========
  async function handleExport() {
    try {
      const res = await fetch('/api/todos/export')
      if (res.ok) {
        const blob = await res.blob()
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `todo-export-${new Date().toISOString().slice(0, 10)}.json`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
      }
    } catch { /* noop */ }
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setImportStatus('')

    try {
      const text = await file.text()
      let data
      try {
        data = JSON.parse(text)
      } catch {
        setImportStatus('Error: Invalid JSON file')
        return
      }

      const res = await fetch('/api/todos/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      if (res.ok) {
        const result = await res.json()
        setImportStatus(`Imported ${result.imported.todos} todos, ${result.imported.subtasks} subtasks, ${result.imported.tags} tags`)
        await Promise.all([fetchTodos(), fetchTags()])
      } else {
        const err = await res.json()
        setImportStatus(`Error: ${err.error}`)
      }
    } catch {
      setImportStatus('Error: Failed to import file')
    }

    // Reset file input
    e.target.value = ''
  }

  // ========== Filtering ==========
  const filteredTodos = todos.filter(todo => {
    if (filterPriority !== 'all' && todo.priority !== filterPriority) return false
    if (filterTag !== 'all' && !todo.tags.some(t => t.id === filterTag)) return false
    if (filterCompleted === 'active' && todo.completed) return false
    if (filterCompleted === 'completed' && !todo.completed) return false

    // Date range filter
    if (filterDateFrom && todo.due_date && new Date(todo.due_date) < new Date(filterDateFrom)) return false
    if (filterDateTo && todo.due_date && new Date(todo.due_date) > new Date(filterDateTo + 'T23:59:59')) return false

    // Search filter
    if (searchDebounced) {
      const q = searchDebounced.toLowerCase()
      const titleMatch = todo.title.toLowerCase().includes(q)
      const tagMatch = todo.tags.some(t => t.name.toLowerCase().includes(q))
      const subtaskMatch = todo.subtasks.some(s => s.title.toLowerCase().includes(q))
      if (!titleMatch && !tagMatch && !subtaskMatch) return false
    }

    return true
  })

  const hasActiveFilters = filterPriority !== 'all' || filterTag !== 'all' || searchDebounced !== '' || filterCompleted !== 'all' || filterDateFrom !== '' || filterDateTo !== ''

  const overdueTodos = filteredTodos.filter(t => isOverdue(t))
  const pendingTodos = filteredTodos.filter(t => !t.completed && !isOverdue(t))
  const completedTodos = filteredTodos.filter(t => t.completed)

  // ========== Render ==========
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-gray-500 dark:text-gray-400 text-lg">Loading...</div>
      </div>
    )
  }

  const minDateTime = new Date(Date.now() + 60000).toISOString().slice(0, 16)

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors">
      <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:top-2 focus:left-2 focus:px-4 focus:py-2 focus:bg-blue-600 focus:text-white focus:rounded-lg">Skip to main content</a>
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">✅ Todo App</h1>
          <div className="flex items-center gap-3">
            {permission !== 'granted' && permission !== 'unsupported' && (
              <button
                onClick={requestPermission}
                className="text-sm px-3 py-1.5 bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300 rounded-lg hover:bg-amber-200 dark:hover:bg-amber-900/60 transition"
                title="Enable browser notifications for reminders"
              >
                🔔 Enable Notifications
              </button>
            )}
            {permission === 'granted' && (
              <span className="text-xs text-green-600 dark:text-green-400" title="Notifications enabled">🔔 On</span>
            )}
            <button
              onClick={toggleDarkMode}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition"
              aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {darkMode ? '☀️' : '🌙'}
            </button>
            <Link
              href="/calendar"
              className="text-sm px-3 py-1.5 bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 rounded-lg hover:bg-indigo-200 dark:hover:bg-indigo-900/60 transition"
            >
              📅 Calendar
            </Link>
            <button
              onClick={() => setShowTemplateManager(true)}
              className="text-sm px-3 py-1.5 bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 rounded-lg hover:bg-green-200 dark:hover:bg-green-900/60 transition"
            >
              📋 Templates
            </button>
            <button
              onClick={() => setShowTagManager(true)}
              className="text-sm px-3 py-1.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition"
            >
              🏷️ Tags
            </button>
            <span className="text-sm text-gray-500 dark:text-gray-400">
              {user?.username}
            </span>
            <button
              onClick={handleLogout}
              className="text-sm px-3 py-1.5 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/50 transition"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      <main id="main-content" className="max-w-4xl mx-auto px-4 py-6">
        {/* Create Todo Form */}
        <form onSubmit={handleCreateTodo} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Create Todo</h2>

          {formError && (
            <div role="alert" className="mb-3 p-2 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-300 text-sm">
              {formError}
            </div>
          )}

          <div className="space-y-3">
            <div>
              <label htmlFor="create-title" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Title *</label>
              <input
                id="create-title"
                type="text"
                value={formTitle}
                onChange={e => setFormTitle(e.target.value)}
                placeholder="What needs to be done?"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              />
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <label htmlFor="create-priority" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Priority</label>
                <select
                  id="create-priority"
                  value={formPriority}
                  onChange={e => setFormPriority(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <option value="high">🔴 High</option>
                  <option value="medium">🟡 Medium</option>
                  <option value="low">🔵 Low</option>
                </select>
              </div>

              <div>
                <label htmlFor="create-due-date" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Due Date</label>
                <input
                  id="create-due-date"
                  type="datetime-local"
                  value={formDueDate}
                  min={minDateTime}
                  onChange={e => setFormDueDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              <div>
                <label htmlFor="create-reminder" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Reminder</label>
                <select
                  id="create-reminder"
                  value={formReminderMinutes}
                  onChange={e => setFormReminderMinutes(Number(e.target.value))}
                  disabled={!formDueDate}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none disabled:opacity-50"
                >
                  {REMINDER_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Recurring</label>
                <div className="flex items-center gap-2">
                  <input
                    id="create-recurring"
                    type="checkbox"
                    checked={formIsRecurring}
                    onChange={e => setFormIsRecurring(e.target.checked)}
                    disabled={!formDueDate}
                    className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 disabled:opacity-50"
                  />
                  <select
                    id="create-recurrence-pattern"
                    value={formRecurrencePattern}
                    onChange={e => setFormRecurrencePattern(e.target.value)}
                    disabled={!formIsRecurring || !formDueDate}
                    className="flex-1 px-2 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 outline-none disabled:opacity-50"
                  >
                    {RECURRENCE_PATTERNS.map(p => (
                      <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Tag selection for new todo */}
            {tags.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Tags</label>
                <div className="flex flex-wrap gap-2">
                  {tags.map(tag => (
                    <button
                      key={tag.id}
                      type="button"
                      onClick={() => {
                        setFormSelectedTags(prev =>
                          prev.includes(tag.id)
                            ? prev.filter(id => id !== tag.id)
                            : [...prev, tag.id]
                        )
                      }}
                      className={`px-3 py-1 rounded-full text-xs font-medium transition ${
                        formSelectedTags.includes(tag.id)
                          ? 'ring-2 ring-offset-1 ring-gray-400 dark:ring-gray-500'
                          : 'opacity-60 hover:opacity-100'
                      }`}
                      style={{ backgroundColor: tag.color, color: '#fff' }}
                    >
                      {formSelectedTags.includes(tag.id) && '✓ '}{tag.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <button
                type="submit"
                className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              >
                Add Todo
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!formTitle.trim()) return
                  setShowSaveTemplate(true)
                }}
                className="px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
                title="Save current form as template"
              >
                📋 Save as Template
              </button>
            </div>
          </div>
        </form>

        {/* Search & Filter Bar */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 mb-6">
          <div className="flex items-center gap-3 flex-wrap">
            {/* Search input */}
            <div className="relative flex-1 min-w-[200px]">
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search todos, tags, subtasks..."
                className="w-full px-3 py-1.5 pl-8 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                aria-label="Search todos"
              />
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-sm"
                  aria-label="Clear search"
                >
                  ✕
                </button>
              )}
            </div>

            <select
              value={filterPriority}
              onChange={e => setFilterPriority(e.target.value)}
              className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
              aria-label="Filter by priority"
            >
              <option value="all">All Priorities</option>
              <option value="high">🔴 High</option>
              <option value="medium">🟡 Medium</option>
              <option value="low">🔵 Low</option>
            </select>

            <select
              value={filterTag === 'all' ? 'all' : String(filterTag)}
              onChange={e => setFilterTag(e.target.value === 'all' ? 'all' : Number(e.target.value))}
              className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
              aria-label="Filter by tag"
            >
              <option value="all">All Tags</option>
              {tags.map(tag => (
                <option key={tag.id} value={tag.id}>{tag.name}</option>
              ))}
            </select>

            <button
              onClick={() => setShowAdvancedFilters(prev => !prev)}
              className="text-sm px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 transition"
            >
              {showAdvancedFilters ? '▼ Advanced' : '▶ Advanced'}
            </button>

            {hasActiveFilters && (
              <button
                onClick={() => { setFilterPriority('all'); setFilterTag('all'); setSearchQuery(''); setFilterCompleted('all'); setFilterDateFrom(''); setFilterDateTo('') }}
                className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                aria-label="Clear all filters"
              >
                Clear All
              </button>
            )}

            <span className="text-sm text-gray-500 dark:text-gray-400 ml-auto">
              {filteredTodos.length} todo{filteredTodos.length !== 1 ? 's' : ''}
            </span>
          </div>

          {/* Advanced filters */}
          {showAdvancedFilters && (
            <div className="flex items-center gap-3 mt-3 flex-wrap border-t border-gray-200 dark:border-gray-700 pt-3">
              <select
                value={filterCompleted}
                onChange={e => setFilterCompleted(e.target.value as 'all' | 'active' | 'completed')}
                className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                aria-label="Filter by status"
              >
                <option value="all">All Status</option>
                <option value="active">Active Only</option>
                <option value="completed">Completed Only</option>
              </select>

              <div className="flex items-center gap-2">
                <label className="text-xs text-gray-500 dark:text-gray-400">From:</label>
                <input
                  type="date"
                  value={filterDateFrom}
                  onChange={e => setFilterDateFrom(e.target.value)}
                  className="px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                  aria-label="Filter from date"
                />
              </div>

              <div className="flex items-center gap-2">
                <label className="text-xs text-gray-500 dark:text-gray-400">To:</label>
                <input
                  type="date"
                  value={filterDateTo}
                  onChange={e => setFilterDateTo(e.target.value)}
                  className="px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                  aria-label="Filter to date"
                />
              </div>
            </div>
          )}

          {/* Export / Import row */}
          <div className="flex items-center gap-3 mt-3 border-t border-gray-200 dark:border-gray-700 pt-3">
            <button
              onClick={handleExport}
              className="text-sm px-3 py-1.5 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 rounded-lg hover:bg-emerald-200 dark:hover:bg-emerald-900/60 transition"
            >
              📤 Export
            </button>
            <label className="text-sm px-3 py-1.5 bg-sky-100 dark:bg-sky-900/40 text-sky-700 dark:text-sky-300 rounded-lg hover:bg-sky-200 dark:hover:bg-sky-900/60 transition cursor-pointer">
              📥 Import
              <input type="file" accept=".json" onChange={handleImport} className="hidden" />
            </label>
            {importStatus && (
              <span role="status" aria-live="polite" className={`text-sm ${importStatus.startsWith('Error') ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                {importStatus}
              </span>
            )}
          </div>
        </div>

        {/* Overdue Section */}
        {overdueTodos.length > 0 && (
          <section className="mb-6">
            <h2 className="text-sm font-semibold text-red-600 dark:text-red-400 uppercase tracking-wider mb-3">
              ⚠️ Overdue ({overdueTodos.length})
            </h2>
            <div className="space-y-2">
              {overdueTodos.map(todo => renderTodoCard(todo))}
            </div>
          </section>
        )}

        {/* Pending Section */}
        <section className="mb-6">
          <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
            📋 Pending ({pendingTodos.length})
          </h2>
          {pendingTodos.length === 0 ? (
            <p className="text-gray-400 dark:text-gray-500 text-sm py-4 text-center">
              {todos.length === 0 ? 'No todos yet. Create one above!' : 'No pending todos match your filters.'}
            </p>
          ) : (
            <div className="space-y-2">
              {pendingTodos.map(todo => renderTodoCard(todo))}
            </div>
          )}
        </section>

        {/* Completed Section */}
        <section>
          <button
            onClick={() => setShowCompleted(prev => !prev)}
            className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-1 hover:text-gray-700 dark:hover:text-gray-300 transition"
          >
            {showCompleted ? '▼' : '▶'} ✅ Completed ({completedTodos.length})
          </button>
          {showCompleted && completedTodos.length > 0 && (
            <div className="space-y-2">
              {completedTodos.map(todo => renderTodoCard(todo))}
            </div>
          )}
        </section>
      </main>

      {/* Edit Modal */}
      {editingTodo && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setEditingTodo(null)} onKeyDown={e => { if (e.key === 'Escape') setEditingTodo(null) }}>
          <div role="dialog" aria-modal="true" aria-labelledby="edit-modal-title" className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-lg p-6" onClick={e => e.stopPropagation()}>
            <h3 id="edit-modal-title" className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Edit Todo</h3>

            <div className="space-y-3">
              <div>
                <label htmlFor="edit-title" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Title</label>
                <input
                  id="edit-title"
                  type="text"
                  value={editTitle}
                  onChange={e => setEditTitle(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="edit-priority" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Priority</label>
                  <select
                    id="edit-priority"
                    value={editPriority}
                    onChange={e => setEditPriority(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    <option value="high">🔴 High</option>
                    <option value="medium">🟡 Medium</option>
                    <option value="low">🔵 Low</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="edit-due-date" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Due Date</label>
                  <input
                    id="edit-due-date"
                    type="datetime-local"
                    value={editDueDate}
                    min={minDateTime}
                    onChange={e => setEditDueDate(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="edit-reminder" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Reminder</label>
                  <select
                    id="edit-reminder"
                    value={editReminderMinutes}
                    onChange={e => setEditReminderMinutes(Number(e.target.value))}
                    disabled={!editDueDate}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none disabled:opacity-50"
                  >
                    {REMINDER_OPTIONS.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Recurring</label>
                  <div className="flex items-center gap-2">
                    <input
                      id="edit-recurring"
                      type="checkbox"
                      checked={editIsRecurring}
                      onChange={e => setEditIsRecurring(e.target.checked)}
                      disabled={!editDueDate}
                      className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 disabled:opacity-50"
                    />
                    <select
                      id="edit-recurrence-pattern"
                      value={editRecurrencePattern}
                      onChange={e => setEditRecurrencePattern(e.target.value)}
                      disabled={!editIsRecurring || !editDueDate}
                      className="flex-1 px-2 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 outline-none disabled:opacity-50"
                    >
                      {RECURRENCE_PATTERNS.map(p => (
                        <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Tag assignment in edit */}
              {tags.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Tags</label>
                  <div className="flex flex-wrap gap-2">
                    {tags.map(tag => {
                      const assigned = editingTodo.tags.some(t => t.id === tag.id)
                      return (
                        <button
                          key={tag.id}
                          type="button"
                          onClick={() => handleToggleTodoTag(editingTodo.id, tag.id, assigned)}
                          className={`px-3 py-1 rounded-full text-xs font-medium transition ${
                            assigned ? 'ring-2 ring-offset-1 ring-gray-400' : 'opacity-60 hover:opacity-100'
                          }`}
                          style={{ backgroundColor: tag.color, color: '#fff' }}
                        >
                          {assigned && '✓ '}{tag.name}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-3 mt-5">
              <button
                onClick={handleSaveEdit}
                className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition"
              >
                Save Changes
              </button>
              <button
                onClick={() => setEditingTodo(null)}
                className="flex-1 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-medium rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tag Manager Modal */}
      {showTagManager && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => { setShowTagManager(false); setEditingTag(null); setTagName(''); setTagColor('#3B82F6') }} onKeyDown={e => { if (e.key === 'Escape') { setShowTagManager(false); setEditingTag(null); setTagName(''); setTagColor('#3B82F6') } }}>
          <div role="dialog" aria-modal="true" aria-labelledby="tag-modal-title" className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
            <h3 id="tag-modal-title" className="text-lg font-semibold text-gray-900 dark:text-white mb-4">🏷️ Tag Manager</h3>

            <div className="flex gap-2 mb-4">
              <input
                type="text"
                value={tagName}
                onChange={e => setTagName(e.target.value)}
                placeholder="Tag name"
                className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    if (editingTag) handleUpdateTag()
                    else handleCreateTag()
                  }
                }}
              />
              <input
                type="color"
                value={tagColor}
                onChange={e => setTagColor(e.target.value)}
                className="w-10 h-10 rounded-lg border border-gray-300 dark:border-gray-600 cursor-pointer"
                title="Choose tag color"
              />
              <button
                onClick={editingTag ? handleUpdateTag : handleCreateTag}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition"
              >
                {editingTag ? 'Update' : 'Add'}
              </button>
            </div>

            {editingTag && (
              <button
                onClick={() => { setEditingTag(null); setTagName(''); setTagColor('#3B82F6') }}
                className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 mb-3 block"
              >
                ← Cancel editing
              </button>
            )}

            <div className="space-y-2 max-h-60 overflow-y-auto">
              {tags.length === 0 ? (
                <p className="text-gray-400 dark:text-gray-500 text-sm text-center py-4">No tags yet</p>
              ) : (
                tags.map(tag => (
                  <div key={tag.id} className="flex items-center justify-between p-2 rounded-lg bg-gray-50 dark:bg-gray-700/50">
                    <span
                      className="px-3 py-1 rounded-full text-xs font-medium text-white"
                      style={{ backgroundColor: tag.color }}
                    >
                      {tag.name}
                    </span>
                    <div className="flex gap-1">
                      <button
                        onClick={() => { setEditingTag(tag); setTagName(tag.name); setTagColor(tag.color) }}
                        className="text-xs px-2 py-1 text-gray-500 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400 transition"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeleteTag(tag.id)}
                        className="text-xs px-2 py-1 text-gray-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400 transition"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <button
              onClick={() => { setShowTagManager(false); setEditingTag(null); setTagName(''); setTagColor('#3B82F6') }}
              className="w-full mt-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-medium rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Template Manager Modal */}
      {showTemplateManager && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => { setShowTemplateManager(false); setEditingTemplate(null); setTemplateName(''); setTemplateDescription(''); setTemplateCategory('') }} onKeyDown={e => { if (e.key === 'Escape') { setShowTemplateManager(false); setEditingTemplate(null); setTemplateName(''); setTemplateDescription(''); setTemplateCategory('') } }}>
          <div role="dialog" aria-modal="true" aria-labelledby="template-modal-title" className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-lg p-6 max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <h3 id="template-modal-title" className="text-lg font-semibold text-gray-900 dark:text-white mb-4">📋 Template Manager</h3>

            {/* Edit template form */}
            {editingTemplate && (
              <div className="mb-4 p-3 border border-blue-200 dark:border-blue-700 rounded-lg bg-blue-50 dark:bg-blue-900/20">
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Edit Template</h4>
                <input type="text" value={templateName} onChange={e => setTemplateName(e.target.value)} placeholder="Template name" className="w-full px-3 py-1.5 mb-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white outline-none" />
                <input type="text" value={templateDescription} onChange={e => setTemplateDescription(e.target.value)} placeholder="Description (optional)" className="w-full px-3 py-1.5 mb-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white outline-none" />
                <input type="text" value={templateCategory} onChange={e => setTemplateCategory(e.target.value)} placeholder="Category (optional)" className="w-full px-3 py-1.5 mb-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white outline-none" />
                <div className="flex gap-2">
                  <button onClick={handleUpdateTemplate} className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition">Update</button>
                  <button onClick={() => { setEditingTemplate(null); setTemplateName(''); setTemplateDescription(''); setTemplateCategory('') }} className="px-4 py-1.5 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-sm rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition">Cancel</button>
                </div>
              </div>
            )}

            {/* Category filter */}
            {templates.length > 0 && (
              <div className="mb-3">
                <select
                  value={templateFilterCategory}
                  onChange={e => setTemplateFilterCategory(e.target.value)}
                  className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white outline-none"
                  aria-label="Filter templates by category"
                >
                  <option value="all">All Categories</option>
                  {[...new Set(templates.filter(t => t.category).map(t => t.category))].map(cat => (
                    <option key={cat} value={cat!}>{cat}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Template list */}
            <div className="space-y-3">
              {templates.length === 0 ? (
                <p className="text-gray-400 dark:text-gray-500 text-sm text-center py-4">No templates yet. Save a todo configuration as a template from the create form.</p>
              ) : (
                templates
                  .filter(t => templateFilterCategory === 'all' || t.category === templateFilterCategory)
                  .map(template => (
                  <div key={template.id} className="p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 dark:text-white text-sm">{template.name}</p>
                        {template.description && <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{template.description}</p>}
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          {template.category && <span className="text-xs px-2 py-0.5 rounded-full bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300">{template.category}</span>}
                          <span className="text-xs text-gray-500 dark:text-gray-400">Title: {template.title_template}</span>
                          <span className={`text-xs px-1.5 py-0.5 rounded-full ${PRIORITY_COLORS[template.priority]?.bg} ${PRIORITY_COLORS[template.priority]?.text} ${PRIORITY_COLORS[template.priority]?.darkBg} ${PRIORITY_COLORS[template.priority]?.darkText}`}>{template.priority}</span>
                          {template.is_recurring && <span className="text-xs">🔄 {template.recurrence_pattern}</span>}
                          {template.reminder_minutes && <span className="text-xs">🔔 {getReminderLabel(template.reminder_minutes)}</span>}
                          {template.subtasks.length > 0 && <span className="text-xs text-gray-500 dark:text-gray-400">{template.subtasks.length} subtask{template.subtasks.length > 1 ? 's' : ''}</span>}
                        </div>
                      </div>
                      <div className="flex gap-1 ml-2 flex-shrink-0">
                        <button onClick={() => handleUseTemplate(template)} className="text-xs px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded transition" title="Create todo from template">Use</button>
                        <button onClick={() => { setEditingTemplate(template); setTemplateName(template.name); setTemplateDescription(template.description || ''); setTemplateCategory(template.category || '') }} className="text-xs px-2 py-1 text-gray-500 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400 transition">Edit</button>
                        <button onClick={() => handleDeleteTemplate(template.id)} className="text-xs px-2 py-1 text-gray-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400 transition">Delete</button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            <button
              onClick={() => { setShowTemplateManager(false); setEditingTemplate(null); setTemplateName(''); setTemplateDescription(''); setTemplateCategory('') }}
              className="w-full mt-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-medium rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Save as Template Modal */}
      {showSaveTemplate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => { setShowSaveTemplate(false); setTemplateName(''); setTemplateDescription(''); setTemplateCategory('') }} onKeyDown={e => { if (e.key === 'Escape') { setShowSaveTemplate(false); setTemplateName(''); setTemplateDescription(''); setTemplateCategory('') } }}>
          <div role="dialog" aria-modal="true" aria-labelledby="save-template-title" className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
            <h3 id="save-template-title" className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Save as Template</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Template Name *</label>
                <input type="text" value={templateName} onChange={e => setTemplateName(e.target.value)} placeholder="e.g. Weekly Report" className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none" autoFocus />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
                <input type="text" value={templateDescription} onChange={e => setTemplateDescription(e.target.value)} placeholder="Optional description" className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Category</label>
                <input type="text" value={templateCategory} onChange={e => setTemplateCategory(e.target.value)} placeholder="e.g. Work, Personal" className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none" />
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Will save: &quot;{editingTodo?.title || formTitle}&quot; with priority {editingTodo?.priority || formPriority}
                {(editingTodo?.is_recurring || formIsRecurring) && `, ${editingTodo?.recurrence_pattern || formRecurrencePattern} recurring`}
              </p>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={handleSaveAsTemplate} className="flex-1 py-2 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition">Save Template</button>
              <button onClick={() => { setShowSaveTemplate(false); setTemplateName(''); setTemplateDescription(''); setTemplateCategory('') }} className="flex-1 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-medium rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )

  // ========== Todo Card Renderer ==========
  function renderTodoCard(todo: Todo) {
    const overdue = isOverdue(todo)
    const expanded = expandedTodos.has(todo.id)
    const completedSubtasks = todo.subtasks.filter(s => s.completed).length
    const totalSubtasks = todo.subtasks.length
    const progressPct = totalSubtasks > 0 ? Math.round((completedSubtasks / totalSubtasks) * 100) : 0
    const pc = PRIORITY_COLORS[todo.priority] || PRIORITY_COLORS.medium

    return (
      <div
        key={todo.id}
        className={`bg-white dark:bg-gray-800 rounded-xl border p-4 transition ${
          overdue
            ? 'border-red-300 dark:border-red-700'
            : todo.completed
              ? 'border-gray-200 dark:border-gray-700 opacity-70'
              : 'border-gray-200 dark:border-gray-700'
        }`}
      >
        <div className="flex items-start gap-3">
          {/* Checkbox */}
          <button
            onClick={() => handleToggleComplete(todo)}
            className={`mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition ${
              todo.completed
                ? 'bg-green-500 border-green-500 text-white'
                : overdue
                  ? 'border-red-400 hover:border-red-500'
                  : 'border-gray-300 dark:border-gray-600 hover:border-blue-500'
            }`}
            title={todo.completed ? 'Mark as incomplete' : 'Mark as complete'}
            aria-label={`${todo.completed ? 'Mark incomplete' : 'Mark complete'}: ${todo.title}`}
          >
            {todo.completed && <span className="text-xs">✓</span>}
          </button>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`font-medium ${todo.completed ? 'line-through text-gray-400 dark:text-gray-500' : 'text-gray-900 dark:text-white'}`}>
                {todo.title}
              </span>

              {/* Priority badge */}
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${pc.bg} ${pc.text} ${pc.darkBg} ${pc.darkText}`}>
                {todo.priority}
              </span>

              {/* Recurring badge */}
              {todo.is_recurring && (
                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300">
                  🔄 {todo.recurrence_pattern}
                </span>
              )}

              {/* Reminder badge */}
              {todo.reminder_minutes && (
                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                  🔔 {getReminderLabel(todo.reminder_minutes)}
                </span>
              )}
            </div>

            {/* Tags */}
            {todo.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1">
                {todo.tags.map(tag => (
                  <span
                    key={tag.id}
                    className="px-2 py-0.5 rounded-full text-xs font-medium text-white"
                    style={{ backgroundColor: tag.color }}
                  >
                    {tag.name}
                  </span>
                ))}
              </div>
            )}

            {/* Due date */}
            {todo.due_date && (
              <p className={`text-xs mt-1 ${overdue ? 'text-red-500 dark:text-red-400 font-medium' : 'text-gray-500 dark:text-gray-400'}`}>
                {overdue ? '⚠️ Overdue: ' : '📅 '}{formatDate(todo.due_date)}
              </p>
            )}

            {/* Subtask progress bar */}
            {totalSubtasks > 0 && (
              <div className="mt-2">
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-500 rounded-full transition-all"
                      style={{ width: `${progressPct}%` }}
                    />
                  </div>
                  <span className="text-xs text-gray-500 dark:text-gray-400">{completedSubtasks}/{totalSubtasks} subtasks</span>
                </div>
              </div>
            )}

            {/* Expanded subtasks */}
            {expanded && (
              <div className="mt-3 space-y-1.5">
                {todo.subtasks.map(subtask => (
                  <div key={subtask.id} className="flex items-center gap-2 group">
                    <input
                      type="checkbox"
                      checked={subtask.completed}
                      onChange={() => handleToggleSubtask(subtask)}
                      className="w-3.5 h-3.5 text-blue-600 rounded focus:ring-blue-500"
                      aria-label={`Toggle subtask: ${subtask.title}`}
                    />
                    <span className={`text-sm flex-1 ${subtask.completed ? 'line-through text-gray-400 dark:text-gray-500' : 'text-gray-700 dark:text-gray-300'}`}>
                      {subtask.title}
                    </span>
                    <button
                      onClick={() => handleDeleteSubtask(subtask.id)}
                      className="text-xs text-gray-400 hover:text-red-500 dark:text-gray-500 dark:hover:text-red-400 opacity-0 group-hover:opacity-100 transition"
                      title="Delete subtask"
                      aria-label={`Delete subtask: ${subtask.title}`}
                    >
                      ✕
                    </button>
                  </div>
                ))}

                {/* Add subtask input */}
                <div className="flex gap-2 mt-2">
                  <input
                    type="text"
                    value={subtaskInputs[todo.id] || ''}
                    onChange={e => setSubtaskInputs(prev => ({ ...prev, [todo.id]: e.target.value }))}
                    onKeyDown={e => {
                      if (e.key === 'Enter') handleAddSubtask(todo.id)
                    }}
                    placeholder="Add subtask..."
                    className="flex-1 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-1 focus:ring-blue-500 outline-none"
                  />
                  <button
                    onClick={() => handleAddSubtask(todo.id)}
                    className="px-3 py-1 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded transition"
                  >
                    Add
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              onClick={() => setExpandedTodos(prev => {
                const next = new Set(prev)
                if (next.has(todo.id)) next.delete(todo.id)
                else next.add(todo.id)
                return next
              })}
              className="p-1.5 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 transition"
              title={expanded ? 'Collapse subtasks' : 'Expand subtasks'}
              aria-label={expanded ? 'Collapse subtasks' : 'Expand subtasks'}
            >
              {expanded ? '▼' : '▶'}
            </button>
            <button
              onClick={() => startEditing(todo)}
              className="p-1.5 text-gray-400 hover:text-blue-600 dark:text-gray-500 dark:hover:text-blue-400 transition"
              title="Edit todo"
              aria-label={`Edit: ${todo.title}`}
            >
              ✏️
            </button>
            <button
              onClick={() => handleDeleteTodo(todo.id)}
              className="p-1.5 text-gray-400 hover:text-red-600 dark:text-gray-500 dark:hover:text-red-400 transition"
              title="Delete todo"
              aria-label={`Delete: ${todo.title}`}
            >
              🗑️
            </button>
          </div>

          {/* Inline delete confirmation */}
          {confirmingDeleteId === todo.id && (
            <div className="flex items-center gap-2 mt-2 p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <span className="text-sm text-red-700 dark:text-red-300">Delete this todo?</span>
              <button
                onClick={confirmDelete}
                className="px-3 py-1 text-xs font-medium bg-red-600 hover:bg-red-700 text-white rounded-lg transition"
                aria-label="Confirm delete"
              >
                Confirm
              </button>
              <button
                onClick={() => setConfirmingDeleteId(null)}
                className="px-3 py-1 text-xs font-medium bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 text-gray-700 dark:text-gray-200 rounded-lg transition"
                aria-label="Cancel delete"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      </div>
    )
  }
}
