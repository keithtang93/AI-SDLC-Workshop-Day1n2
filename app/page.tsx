'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useNotifications } from '@/lib/hooks/useNotifications'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Todo {
  id: string
  title: string
  description: string | null
  priority: 'high' | 'medium' | 'low'
  due_date: string | null
  completed: boolean
  is_recurring: boolean
  recurrence_pattern: string | null
  reminder_minutes: number | null
  last_notification_sent: string | null
  created_at: string
  updated_at: string
  tags: Tag[]
  subtasks: Subtask[]
}

interface Subtask {
  id: string
  todo_id: string
  title: string
  completed: boolean
  position: number
  created_at: string
}

interface Tag {
  id: string
  user_id: string
  name: string
  color: string
  created_at: string
}

interface Template {
  id: string
  name: string
  description: string | null
  category: string | null
  title_template: string
  priority: string
  is_recurring: boolean
  recurrence_pattern: string | null
  reminder_minutes: number | null
  due_date_offset_days: number | null
  subtasks_json: string | null
}

interface FilterPreset {
  name: string
  query: string
  priority: string
  tagId: string
  completion: string
  dateFrom: string
  dateTo: string
}

// ─── Constants ────────────────────────────────────────────────────────────────

const REMINDER_OPTIONS = [
  { value: '', label: 'None' },
  { value: '15', label: '15 minutes before' },
  { value: '30', label: '30 minutes before' },
  { value: '60', label: '1 hour before' },
  { value: '120', label: '2 hours before' },
  { value: '1440', label: '1 day before' },
  { value: '2880', label: '2 days before' },
  { value: '10080', label: '1 week before' },
]

const PRIORITY_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  high: { bg: 'bg-red-100 dark:bg-red-900/40', text: 'text-red-700 dark:text-red-400', border: 'border-red-200 dark:border-red-800' },
  medium: { bg: 'bg-yellow-100 dark:bg-yellow-900/40', text: 'text-yellow-700 dark:text-yellow-400', border: 'border-yellow-200 dark:border-yellow-800' },
  low: { bg: 'bg-blue-100 dark:bg-blue-900/40', text: 'text-blue-700 dark:text-blue-400', border: 'border-blue-200 dark:border-blue-800' },
}

const PRIORITY_ORDER: Record<string, number> = { high: 0, medium: 1, low: 2 }

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDueDisplay(dueDate: string): { text: string; color: string } {
  const due = new Date(dueDate)
  const now = new Date()
  const diff = due.getTime() - now.getTime()
  const absDiff = Math.abs(diff)
  const minutes = Math.floor(absDiff / (1000 * 60))
  const hours = Math.floor(absDiff / (1000 * 60 * 60))
  const days = Math.floor(absDiff / (1000 * 60 * 60 * 24))

  if (diff < 0) {
    if (days > 0) return { text: `${days} day${days > 1 ? 's' : ''} overdue`, color: 'text-red-600 dark:text-red-400' }
    if (hours > 0) return { text: `${hours} hour${hours > 1 ? 's' : ''} overdue`, color: 'text-red-600 dark:text-red-400' }
    return { text: `${minutes} minute${minutes > 1 ? 's' : ''} overdue`, color: 'text-red-600 dark:text-red-400' }
  }
  if (minutes < 60) return { text: `Due in ${minutes} minute${minutes > 1 ? 's' : ''}`, color: 'text-red-600 dark:text-red-400' }
  if (hours < 24) return { text: `Due in ${hours} hour${hours > 1 ? 's' : ''}`, color: 'text-orange-600 dark:text-orange-400' }
  if (days < 7) return { text: `Due in ${days} day${days > 1 ? 's' : ''}`, color: 'text-yellow-600 dark:text-yellow-400' }
  return { text: due.toLocaleDateString('en-SG', { timeZone: 'Asia/Singapore', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }), color: 'text-blue-600 dark:text-blue-400' }
}

function getReminderLabel(minutes: number): string {
  if (minutes === 15) return '15m'
  if (minutes === 30) return '30m'
  if (minutes === 60) return '1h'
  if (minutes === 120) return '2h'
  if (minutes === 1440) return '1d'
  if (minutes === 2880) return '2d'
  if (minutes === 10080) return '1w'
  return `${minutes}m`
}

function sortTodos(a: Todo, b: Todo): number {
  const pa = PRIORITY_ORDER[a.priority] ?? 1
  const pb = PRIORITY_ORDER[b.priority] ?? 1
  if (pa !== pb) return pa - pb
  if (a.due_date && b.due_date) return new Date(a.due_date).getTime() - new Date(b.due_date).getTime()
  if (a.due_date) return -1
  if (b.due_date) return 1
  return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function HomePage() {
  const router = useRouter()
  const { enabled: notificationsEnabled, requestPermission } = useNotifications()

  // Auth state
  const [user, setUser] = useState<{ userId: string; username: string } | null>(null)

  // Todo state
  const [todos, setTodos] = useState<Todo[]>([])
  const [loading, setLoading] = useState(true)

  // Create form state
  const [title, setTitle] = useState('')
  const [priority, setPriority] = useState('medium')
  const [dueDate, setDueDate] = useState('')
  const [isRecurring, setIsRecurring] = useState(false)
  const [recurrencePattern, setRecurrencePattern] = useState('daily')
  const [reminderMinutes, setReminderMinutes] = useState('')
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([])

  // Edit state
  const [editingTodo, setEditingTodo] = useState<Todo | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editPriority, setEditPriority] = useState('medium')
  const [editDueDate, setEditDueDate] = useState('')
  const [editIsRecurring, setEditIsRecurring] = useState(false)
  const [editRecurrencePattern, setEditRecurrencePattern] = useState('daily')
  const [editReminderMinutes, setEditReminderMinutes] = useState('')
  const [editTagIds, setEditTagIds] = useState<string[]>([])

  // Tags state
  const [tags, setTags] = useState<Tag[]>([])
  const [showTagModal, setShowTagModal] = useState(false)
  const [newTagName, setNewTagName] = useState('')
  const [newTagColor, setNewTagColor] = useState('#3B82F6')
  const [editingTag, setEditingTag] = useState<Tag | null>(null)
  const [editTagName, setEditTagName] = useState('')
  const [editTagColor, setEditTagColor] = useState('')

  // Template state
  const [templates, setTemplates] = useState<Template[]>([])
  const [showTemplateModal, setShowTemplateModal] = useState(false)
  const [showSaveTemplateModal, setShowSaveTemplateModal] = useState(false)
  const [templateName, setTemplateName] = useState('')
  const [templateDescription, setTemplateDescription] = useState('')
  const [templateCategory, setTemplateCategory] = useState('')

  // Subtask state
  const [expandedTodoIds, setExpandedTodoIds] = useState<Set<string>>(new Set())
  const [newSubtaskTitle, setNewSubtaskTitle] = useState<Record<string, string>>({})

  // Search/filter state
  const [searchQuery, setSearchQuery] = useState('')
  const [priorityFilter, setPriorityFilter] = useState('all')
  const [tagFilter, setTagFilter] = useState('all')
  const [completionFilter, setCompletionFilter] = useState('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false)
  const [filterPresets, setFilterPresets] = useState<FilterPreset[]>([])
  const [showSaveFilterModal, setShowSaveFilterModal] = useState(false)
  const [filterPresetName, setFilterPresetName] = useState('')

  // Feedback
  const [feedback, setFeedback] = useState('')

  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [debouncedQuery, setDebouncedQuery] = useState('')

  // ─── Init ─────────────────────────────────────────────────────────────────

  useEffect(() => {
    fetch('/api/auth/me')
      .then(res => {
        if (!res.ok) throw new Error('Not authenticated')
        return res.json()
      })
      .then(setUser)
      .catch(() => router.push('/login'))
  }, [router])

  const fetchTodos = useCallback(async () => {
    try {
      const res = await fetch('/api/todos')
      if (res.ok) {
        const data = await res.json()
        setTodos(data)
      }
    } catch {
      // ignore
    }
  }, [])

  const fetchTags = useCallback(async () => {
    try {
      const res = await fetch('/api/tags')
      if (res.ok) setTags(await res.json())
    } catch {
      // ignore
    }
  }, [])

  const fetchTemplates = useCallback(async () => {
    try {
      const res = await fetch('/api/templates')
      if (res.ok) setTemplates(await res.json())
    } catch {
      // ignore
    }
  }, [])

  useEffect(() => {
    if (user) {
      Promise.all([fetchTodos(), fetchTags(), fetchTemplates()]).then(() => setLoading(false))
    }
  }, [user, fetchTodos, fetchTags, fetchTemplates])

  // Load filter presets from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('filterPresets')
      if (saved) setFilterPresets(JSON.parse(saved))
    } catch {
      // ignore
    }
  }, [])

  // Debounced search
  useEffect(() => {
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current)
    searchTimeoutRef.current = setTimeout(() => setDebouncedQuery(searchQuery), 300)
    return () => { if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current) }
  }, [searchQuery])

  // ─── Show feedback ─────────────────────────────────────────────────────────

  function showFeedback(msg: string) {
    setFeedback(msg)
    setTimeout(() => setFeedback(''), 3000)
  }

  // ─── Todo CRUD ─────────────────────────────────────────────────────────────

  async function handleCreateTodo() {
    if (!title.trim()) { showFeedback('Title is required'); return }

    try {
      const res = await fetch('/api/todos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          priority,
          dueDate: dueDate || null,
          isRecurring,
          recurrencePattern: isRecurring ? recurrencePattern : null,
          reminderMinutes: reminderMinutes ? Number(reminderMinutes) : null,
          tagIds: selectedTagIds,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        showFeedback(data.error || 'Failed to create todo')
        return
      }

      const newTodo = await res.json()
      setTodos(prev => [newTodo, ...prev])
      setTitle('')
      setPriority('medium')
      setDueDate('')
      setIsRecurring(false)
      setRecurrencePattern('daily')
      setReminderMinutes('')
      setSelectedTagIds([])
      showFeedback('Todo created!')
    } catch {
      showFeedback('Failed to create todo')
    }
  }

  async function handleToggleComplete(todo: Todo) {
    try {
      const res = await fetch(`/api/todos/${todo.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ completed: !todo.completed }),
      })

      if (res.ok) {
        await fetchTodos()
      }
    } catch {
      showFeedback('Failed to update todo')
    }
  }

  async function handleDeleteTodo(id: string) {
    if (!window.confirm('Are you sure you want to delete this todo? This will also delete all subtasks.')) return
    try {
      const res = await fetch(`/api/todos/${id}`, { method: 'DELETE' })
      if (res.ok) {
        setTodos(prev => prev.filter(t => t.id !== id))
        showFeedback('Todo deleted')
      }
    } catch {
      showFeedback('Failed to delete todo')
    }
  }

  function startEdit(todo: Todo) {
    setEditingTodo(todo)
    setEditTitle(todo.title)
    setEditPriority(todo.priority)
    setEditDueDate(todo.due_date ? todo.due_date.slice(0, 16) : '')
    setEditIsRecurring(todo.is_recurring)
    setEditRecurrencePattern(todo.recurrence_pattern || 'daily')
    setEditReminderMinutes(todo.reminder_minutes != null ? String(todo.reminder_minutes) : '')
    setEditTagIds(todo.tags.map(t => t.id))
  }

  async function handleUpdateTodo() {
    if (!editingTodo || !editTitle.trim()) { showFeedback('Title is required'); return }

    try {
      const res = await fetch(`/api/todos/${editingTodo.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: editTitle.trim(),
          priority: editPriority,
          dueDate: editDueDate || null,
          isRecurring: editIsRecurring,
          recurrencePattern: editIsRecurring ? editRecurrencePattern : null,
          reminderMinutes: editReminderMinutes ? Number(editReminderMinutes) : null,
          tagIds: editTagIds,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        showFeedback(data.error || 'Failed to update todo')
        return
      }

      await fetchTodos()
      setEditingTodo(null)
      showFeedback('Todo updated!')
    } catch {
      showFeedback('Failed to update todo')
    }
  }

  // ─── Subtask handlers ─────────────────────────────────────────────────────

  function toggleExpanded(todoId: string) {
    setExpandedTodoIds(prev => {
      const next = new Set(prev)
      if (next.has(todoId)) next.delete(todoId)
      else next.add(todoId)
      return next
    })
  }

  async function handleAddSubtask(todoId: string) {
    const subtaskTitle = newSubtaskTitle[todoId]?.trim()
    if (!subtaskTitle) return

    try {
      const res = await fetch(`/api/todos/${todoId}/subtasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: subtaskTitle }),
      })

      if (res.ok) {
        setNewSubtaskTitle(prev => ({ ...prev, [todoId]: '' }))
        await fetchTodos()
      }
    } catch {
      showFeedback('Failed to add subtask')
    }
  }

  async function handleToggleSubtask(subtask: Subtask) {
    try {
      await fetch(`/api/subtasks/${subtask.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ completed: !subtask.completed }),
      })
      await fetchTodos()
    } catch {
      showFeedback('Failed to update subtask')
    }
  }

  async function handleDeleteSubtask(subtaskId: string) {
    try {
      await fetch(`/api/subtasks/${subtaskId}`, { method: 'DELETE' })
      await fetchTodos()
    } catch {
      showFeedback('Failed to delete subtask')
    }
  }

  // ─── Tag handlers ─────────────────────────────────────────────────────────

  async function handleCreateTag() {
    if (!newTagName.trim()) return
    try {
      const res = await fetch('/api/tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newTagName.trim(), color: newTagColor }),
      })
      if (!res.ok) {
        const data = await res.json()
        showFeedback(data.error || 'Failed to create tag')
        return
      }
      setNewTagName('')
      setNewTagColor('#3B82F6')
      await fetchTags()
      showFeedback('Tag created!')
    } catch {
      showFeedback('Failed to create tag')
    }
  }

  async function handleUpdateTag() {
    if (!editingTag || !editTagName.trim()) return
    try {
      const res = await fetch(`/api/tags/${editingTag.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editTagName.trim(), color: editTagColor }),
      })
      if (res.ok) {
        setEditingTag(null)
        await Promise.all([fetchTags(), fetchTodos()])
        showFeedback('Tag updated!')
      }
    } catch {
      showFeedback('Failed to update tag')
    }
  }

  async function handleDeleteTag(tagId: string) {
    try {
      await fetch(`/api/tags/${tagId}`, { method: 'DELETE' })
      await Promise.all([fetchTags(), fetchTodos()])
      showFeedback('Tag deleted')
    } catch {
      showFeedback('Failed to delete tag')
    }
  }

  // ─── Template handlers ────────────────────────────────────────────────────

  async function handleSaveTemplate() {
    if (!templateName.trim() || !title.trim()) return
    try {
      const res = await fetch('/api/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: templateName.trim(),
          description: templateDescription || null,
          category: templateCategory || null,
          titleTemplate: title.trim(),
          priority,
          isRecurring,
          recurrencePattern: isRecurring ? recurrencePattern : null,
          reminderMinutes: reminderMinutes ? Number(reminderMinutes) : null,
        }),
      })
      if (res.ok) {
        setShowSaveTemplateModal(false)
        setTemplateName('')
        setTemplateDescription('')
        setTemplateCategory('')
        await fetchTemplates()
        showFeedback('Template saved!')
      }
    } catch {
      showFeedback('Failed to save template')
    }
  }

  async function handleUseTemplate(templateId: string) {
    try {
      const res = await fetch(`/api/templates/${templateId}/use`, { method: 'POST' })
      if (res.ok) {
        await fetchTodos()
        showFeedback('Todo created from template!')
      }
    } catch {
      showFeedback('Failed to use template')
    }
  }

  async function handleDeleteTemplate(templateId: string) {
    try {
      await fetch(`/api/templates/${templateId}`, { method: 'DELETE' })
      await fetchTemplates()
      showFeedback('Template deleted')
    } catch {
      showFeedback('Failed to delete template')
    }
  }

  // ─── Export / Import ──────────────────────────────────────────────────────

  async function handleExportJSON() {
    try {
      const res = await fetch('/api/todos/export?format=json')
      if (!res.ok) return
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `todos-${new Date().toISOString().split('T')[0]}.json`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      showFeedback('Export failed')
    }
  }

  async function handleExportCSV() {
    try {
      const res = await fetch('/api/todos/export?format=csv')
      if (!res.ok) return
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `todos-${new Date().toISOString().split('T')[0]}.csv`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      showFeedback('Export failed')
    }
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    try {
      const text = await file.text()
      const data = JSON.parse(text)

      const res = await fetch('/api/todos/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      const result = await res.json()
      if (res.ok) {
        await Promise.all([fetchTodos(), fetchTags()])
        showFeedback(result.message || 'Import successful!')
      } else {
        showFeedback(result.error || 'Import failed')
      }
    } catch {
      showFeedback('Failed to import todos. Please check the file format.')
    }

    e.target.value = ''
  }

  // ─── Logout ───────────────────────────────────────────────────────────────

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
  }

  // ─── Filter presets ───────────────────────────────────────────────────────

  function saveFilterPreset() {
    if (!filterPresetName.trim()) return
    const preset: FilterPreset = {
      name: filterPresetName.trim(),
      query: searchQuery, priority: priorityFilter, tagId: tagFilter,
      completion: completionFilter, dateFrom, dateTo,
    }
    const updated = [...filterPresets, preset]
    setFilterPresets(updated)
    localStorage.setItem('filterPresets', JSON.stringify(updated))
    setShowSaveFilterModal(false)
    setFilterPresetName('')
    showFeedback('Filter preset saved!')
  }

  function applyPreset(preset: FilterPreset) {
    setSearchQuery(preset.query)
    setPriorityFilter(preset.priority)
    setTagFilter(preset.tagId)
    setCompletionFilter(preset.completion)
    setDateFrom(preset.dateFrom)
    setDateTo(preset.dateTo)
  }

  function deletePreset(name: string) {
    const updated = filterPresets.filter(p => p.name !== name)
    setFilterPresets(updated)
    localStorage.setItem('filterPresets', JSON.stringify(updated))
  }

  function clearAllFilters() {
    setSearchQuery('')
    setPriorityFilter('all')
    setTagFilter('all')
    setCompletionFilter('all')
    setDateFrom('')
    setDateTo('')
    setDebouncedQuery('')
  }

  const hasActiveFilters = debouncedQuery || priorityFilter !== 'all' || tagFilter !== 'all' || completionFilter !== 'all' || dateFrom || dateTo

  // ─── Filtered & sorted todos ──────────────────────────────────────────────

  const filteredTodos = useMemo(() => {
    let result = todos

    // Search
    if (debouncedQuery) {
      const q = debouncedQuery.toLowerCase()
      result = result.filter(t =>
        t.title.toLowerCase().includes(q) ||
        t.subtasks.some(s => s.title.toLowerCase().includes(q)) ||
        t.tags.some(tag => tag.name.toLowerCase().includes(q))
      )
    }

    // Priority filter
    if (priorityFilter !== 'all') {
      result = result.filter(t => t.priority === priorityFilter)
    }

    // Tag filter
    if (tagFilter !== 'all') {
      result = result.filter(t => t.tags.some(tag => tag.id === tagFilter))
    }

    // Completion filter
    if (completionFilter === 'complete') result = result.filter(t => t.completed)
    else if (completionFilter === 'incomplete') result = result.filter(t => !t.completed)

    // Date range
    if (dateFrom) {
      result = result.filter(t => t.due_date && t.due_date >= dateFrom)
    }
    if (dateTo) {
      result = result.filter(t => t.due_date && t.due_date <= dateTo + 'T23:59:59')
    }

    return result
  }, [todos, debouncedQuery, priorityFilter, tagFilter, completionFilter, dateFrom, dateTo])

  const now = new Date()
  const overdueTodos = filteredTodos.filter(t => !t.completed && t.due_date && new Date(t.due_date) < now).sort(sortTodos)
  const pendingTodos = filteredTodos.filter(t => !t.completed && (!t.due_date || new Date(t.due_date) >= now)).sort(sortTodos)
  const completedTodos = filteredTodos.filter(t => t.completed).sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())

  // ─── Render ───────────────────────────────────────────────────────────────

  if (!user) return null

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full" />
      </div>
    )
  }

  return (
    <div role="main" aria-label="Todo application" className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      {/* Feedback toast */}
      {feedback && (
        <div role="status" aria-live="polite" className="fixed top-4 right-4 z-50 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 px-4 py-2 rounded-lg shadow-lg text-sm">
          {feedback}
        </div>
      )}

      <div className="max-w-4xl mx-auto p-4 sm:p-6">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Todo App</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">Welcome, {user.username}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={requestPermission} className={`px-3 py-1.5 rounded-lg text-sm font-medium ${notificationsEnabled ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400' : 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400'}`}>
              🔔 {notificationsEnabled ? 'Notifications On' : 'Enable Notifications'}
            </button>
            <button onClick={() => router.push('/calendar')} className="px-3 py-1.5 bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-400 rounded-lg text-sm font-medium">Calendar</button>
            <button onClick={() => setShowTagModal(true)} className="px-3 py-1.5 bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300 rounded-lg text-sm font-medium">+ Manage Tags</button>
            <button onClick={() => setShowTemplateModal(true)} className="px-3 py-1.5 bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300 rounded-lg text-sm font-medium">📋 Templates</button>
            <button onClick={handleExportJSON} className="px-3 py-1.5 bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400 rounded-lg text-sm font-medium">Export JSON</button>
            <button onClick={handleExportCSV} className="px-3 py-1.5 bg-green-200 text-green-800 dark:bg-green-900/60 dark:text-green-300 rounded-lg text-sm font-medium">Export CSV</button>
            <label className="px-3 py-1.5 bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400 rounded-lg text-sm font-medium cursor-pointer">
              Import
              <input type="file" accept=".json" onChange={handleImport} className="hidden" />
            </label>
            <button onClick={handleLogout} className="px-3 py-1.5 bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400 rounded-lg text-sm font-medium">Logout</button>
          </div>
        </div>

        {/* Create Form */}
        <div aria-label="Create new todo" className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 mb-4">
          <div className="flex gap-2 mb-3">
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleCreateTodo() }}
              placeholder="What needs to be done?"
              className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm"
            />
            <button onClick={handleCreateTodo} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium">Add</button>
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            <select name="priority" value={priority} onChange={e => setPriority(e.target.value)} className="px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm">
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
            <input type="datetime-local" value={dueDate} onChange={e => setDueDate(e.target.value)} className="px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm" />
            <label className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400">
              <input type="checkbox" checked={isRecurring} onChange={e => setIsRecurring(e.target.checked)} className="rounded" />
              Repeat
            </label>
            {isRecurring && (
              <select value={recurrencePattern} onChange={e => setRecurrencePattern(e.target.value)} className="px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm">
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="yearly">Yearly</option>
              </select>
            )}
            <select name="reminder" value={reminderMinutes} onChange={e => setReminderMinutes(e.target.value)} disabled={!dueDate} className="px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm disabled:opacity-50">
              {REMINDER_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            {templates.length > 0 && (
              <select onChange={e => { if (e.target.value) handleUseTemplate(e.target.value); e.target.value = '' }} className="px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm">
                <option value="">Use Template</option>
                {templates.map(t => (
                  <option key={t.id} value={t.id}>{t.name}{t.category ? ` (${t.category})` : ''}</option>
                ))}
              </select>
            )}
            {title.trim() && (
              <button onClick={() => setShowSaveTemplateModal(true)} className="px-2 py-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300">
                💾 Save as Template
              </button>
            )}
          </div>
          {/* Tag selection */}
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {tags.map(tag => (
                <button
                  key={tag.id}
                  onClick={() => setSelectedTagIds(prev => prev.includes(tag.id) ? prev.filter(id => id !== tag.id) : [...prev, tag.id])}
                  className={`px-2 py-0.5 rounded-full text-xs font-medium border transition-colors ${
                    selectedTagIds.includes(tag.id)
                      ? 'text-white border-transparent'
                      : 'text-gray-600 dark:text-gray-400 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700'
                  }`}
                  style={selectedTagIds.includes(tag.id) ? { backgroundColor: tag.color } : {}}
                >
                  {selectedTagIds.includes(tag.id) ? '✓ ' : ''}{tag.name}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Search & Filters */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 mb-4">
          <div className="flex gap-2 items-center mb-2">
            <div className="relative flex-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search todos and subtasks..."
                aria-label="Search todos"
                className="w-full pl-9 pr-8 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 text-sm outline-none focus:ring-2 focus:ring-blue-500"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">✕</button>
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            <select value={priorityFilter} onChange={e => setPriorityFilter(e.target.value)} aria-label="Filter by priority" className="px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm">
              <option value="all">All Priorities</option>
              <option value="high">High Priority</option>
              <option value="medium">Medium Priority</option>
              <option value="low">Low Priority</option>
            </select>
            {tags.length > 0 && (
              <select value={tagFilter} onChange={e => setTagFilter(e.target.value)} aria-label="Filter by tag" className="px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm">
                <option value="all">All Tags</option>
                {tags.map(tag => (
                  <option key={tag.id} value={tag.id}>{tag.name}</option>
                ))}
              </select>
            )}
            <button
              onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
              className={`px-2 py-1.5 rounded-lg text-sm ${showAdvancedFilters ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400' : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'}`}
            >
              {showAdvancedFilters ? '▼' : '▶'} Advanced
            </button>
            {hasActiveFilters && (
              <>
                <button onClick={clearAllFilters} className="px-2 py-1.5 bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400 rounded-lg text-sm font-medium">Clear All</button>
                <button onClick={() => setShowSaveFilterModal(true)} className="px-2 py-1.5 bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400 rounded-lg text-sm font-medium">💾 Save Filter</button>
              </>
            )}
          </div>
          {showAdvancedFilters && (
            <div className="mt-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg space-y-2">
              <div className="flex flex-wrap gap-2 items-center">
                <select value={completionFilter} onChange={e => setCompletionFilter(e.target.value)} aria-label="Filter by completion status" className="px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm">
                  <option value="all">All Todos</option>
                  <option value="incomplete">Incomplete Only</option>
                  <option value="complete">Completed Only</option>
                </select>
                <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} placeholder="Due Date From" className="px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm" />
                <span className="text-gray-500 dark:text-gray-400 text-sm">to</span>
                <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} placeholder="Due Date To" className="px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm" />
              </div>
              {filterPresets.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  <span className="text-xs text-gray-500 dark:text-gray-400 self-center">Saved:</span>
                  {filterPresets.map(preset => (
                    <span key={preset.name} className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-full text-xs">
                      <button onClick={() => applyPreset(preset)}>{preset.name}</button>
                      <button onClick={() => deletePreset(preset.name)} className="hover:text-red-600">✕</button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Todo Sections */}
        {overdueTodos.length > 0 && (
          <TodoSection title={`Overdue (${overdueTodos.length})`} icon="⚠️" className="bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800">
            {overdueTodos.map(todo => (
              <TodoItem key={todo.id} todo={todo}
                onToggle={() => handleToggleComplete(todo)} onEdit={() => startEdit(todo)} onDelete={() => handleDeleteTodo(todo.id)}
                expanded={expandedTodoIds.has(todo.id)} onToggleExpand={() => toggleExpanded(todo.id)}
                newSubtaskTitle={newSubtaskTitle[todo.id] || ''} onSubtaskTitleChange={val => setNewSubtaskTitle(prev => ({ ...prev, [todo.id]: val }))}
                onAddSubtask={() => handleAddSubtask(todo.id)} onToggleSubtask={handleToggleSubtask} onDeleteSubtask={handleDeleteSubtask}
              />
            ))}
          </TodoSection>
        )}

        <TodoSection title={`Pending (${pendingTodos.length})`} className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
          {pendingTodos.length === 0 ? (
            <p className="text-center text-gray-400 dark:text-gray-500 py-8 text-sm">
              {hasActiveFilters ? 'No matching todos found' : 'No pending todos. Create one above!'}
            </p>
          ) : (
            pendingTodos.map(todo => (
              <TodoItem key={todo.id} todo={todo}
                onToggle={() => handleToggleComplete(todo)} onEdit={() => startEdit(todo)} onDelete={() => handleDeleteTodo(todo.id)}
                expanded={expandedTodoIds.has(todo.id)} onToggleExpand={() => toggleExpanded(todo.id)}
                newSubtaskTitle={newSubtaskTitle[todo.id] || ''} onSubtaskTitleChange={val => setNewSubtaskTitle(prev => ({ ...prev, [todo.id]: val }))}
                onAddSubtask={() => handleAddSubtask(todo.id)} onToggleSubtask={handleToggleSubtask} onDeleteSubtask={handleDeleteSubtask}
              />
            ))
          )}
        </TodoSection>

        {completedTodos.length > 0 && (
          <TodoSection title={`Completed (${completedTodos.length})`} className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
            {completedTodos.map(todo => (
              <TodoItem key={todo.id} todo={todo}
                onToggle={() => handleToggleComplete(todo)} onEdit={() => startEdit(todo)} onDelete={() => handleDeleteTodo(todo.id)}
                expanded={expandedTodoIds.has(todo.id)} onToggleExpand={() => toggleExpanded(todo.id)}
                newSubtaskTitle={newSubtaskTitle[todo.id] || ''} onSubtaskTitleChange={val => setNewSubtaskTitle(prev => ({ ...prev, [todo.id]: val }))}
                onAddSubtask={() => handleAddSubtask(todo.id)} onToggleSubtask={handleToggleSubtask} onDeleteSubtask={handleDeleteSubtask}
              />
            ))}
          </TodoSection>
        )}
      </div>

      {/* ─── Edit Modal ─────────────────────────────────────────────────────── */}
      {editingTodo && (
        <div className="fixed inset-0 bg-black/50 z-40 flex items-center justify-center p-4" onClick={() => setEditingTodo(null)}>
          <div role="dialog" aria-modal="true" aria-label="Edit todo" className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-lg p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Edit Todo</h2>
            <input type="text" value={editTitle} onChange={e => setEditTitle(e.target.value)} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm" />
            <div className="flex flex-wrap gap-2">
              <select value={editPriority} onChange={e => setEditPriority(e.target.value)} className="px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm">
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
              <input type="datetime-local" value={editDueDate} onChange={e => setEditDueDate(e.target.value)} className="px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm" />
              <label className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400">
                <input type="checkbox" checked={editIsRecurring} onChange={e => setEditIsRecurring(e.target.checked)} className="rounded" />
                Repeat
              </label>
              {editIsRecurring && (
                <select value={editRecurrencePattern} onChange={e => setEditRecurrencePattern(e.target.value)} className="px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm">
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                  <option value="yearly">Yearly</option>
                </select>
              )}
              <select value={editReminderMinutes} onChange={e => setEditReminderMinutes(e.target.value)} disabled={!editDueDate} className="px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm disabled:opacity-50">
                {REMINDER_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {tags.map(tag => (
                  <button
                    key={tag.id}
                    onClick={() => setEditTagIds(prev => prev.includes(tag.id) ? prev.filter(id => id !== tag.id) : [...prev, tag.id])}
                    className={`px-2 py-0.5 rounded-full text-xs font-medium border transition-colors ${
                      editTagIds.includes(tag.id) ? 'text-white border-transparent' : 'text-gray-600 dark:text-gray-400 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700'
                    }`}
                    style={editTagIds.includes(tag.id) ? { backgroundColor: tag.color } : {}}
                  >
                    {editTagIds.includes(tag.id) ? '✓ ' : ''}{tag.name}
                  </button>
                ))}
              </div>
            )}
            <div className="flex justify-end gap-2">
              <button onClick={() => setEditingTodo(null)} className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-sm">Cancel</button>
              <button onClick={handleUpdateTodo} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium">Update</button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Tag Management Modal ────────────────────────────────────────────── */}
      {showTagModal && (
        <div className="fixed inset-0 bg-black/50 z-40 flex items-center justify-center p-4" onClick={() => setShowTagModal(false)}>
          <div role="dialog" aria-modal="true" aria-label="Manage tags" className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Manage Tags</h2>
            <div className="flex gap-2">
              <input type="text" value={newTagName} onChange={e => setNewTagName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') handleCreateTag() }} placeholder="Tag name" className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm" />
              <input type="color" value={newTagColor} onChange={e => setNewTagColor(e.target.value)} className="w-10 h-10 rounded border border-gray-300 dark:border-gray-600 cursor-pointer" />
              <button onClick={handleCreateTag} className="px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium">Create Tag</button>
            </div>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {tags.map(tag => (
                <div key={tag.id} className="flex items-center gap-2 p-2 rounded-lg bg-gray-50 dark:bg-gray-700/50">
                  {editingTag?.id === tag.id ? (
                    <>
                      <input type="text" value={editTagName} onChange={e => setEditTagName(e.target.value)} className="flex-1 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm" />
                      <input type="color" value={editTagColor} onChange={e => setEditTagColor(e.target.value)} className="w-8 h-8 rounded cursor-pointer" />
                      <button onClick={handleUpdateTag} className="text-blue-600 dark:text-blue-400 text-sm">Update</button>
                      <button onClick={() => setEditingTag(null)} className="text-gray-400 text-sm">Cancel</button>
                    </>
                  ) : (
                    <>
                      <span className="w-4 h-4 rounded-full" style={{ backgroundColor: tag.color }} />
                      <span className="flex-1 text-sm text-gray-900 dark:text-white">{tag.name}</span>
                      <button onClick={() => { setEditingTag(tag); setEditTagName(tag.name); setEditTagColor(tag.color) }} className="text-blue-600 dark:text-blue-400 text-sm">Edit</button>
                      <button onClick={() => handleDeleteTag(tag.id)} className="text-red-600 dark:text-red-400 text-sm">Delete</button>
                    </>
                  )}
                </div>
              ))}
              {tags.length === 0 && <p className="text-center text-gray-400 text-sm py-4">No tags yet</p>}
            </div>
          </div>
        </div>
      )}

      {/* ─── Template Management Modal ───────────────────────────────────────── */}
      {showTemplateModal && (
        <div className="fixed inset-0 bg-black/50 z-40 flex items-center justify-center p-4" onClick={() => setShowTemplateModal(false)}>
          <div role="dialog" aria-modal="true" aria-label="Templates" className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">📋 Templates</h2>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {templates.map(template => (
                <div key={template.id} className="p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-sm text-gray-900 dark:text-white">{template.name}</span>
                    <div className="flex gap-1">
                      <button onClick={() => { handleUseTemplate(template.id); setShowTemplateModal(false) }} className="text-blue-600 dark:text-blue-400 text-sm">Use</button>
                      <button onClick={() => handleDeleteTemplate(template.id)} className="text-red-600 dark:text-red-400 text-sm">Delete</button>
                    </div>
                  </div>
                  {template.description && <p className="text-xs text-gray-500 dark:text-gray-400">{template.description}</p>}
                  <div className="flex flex-wrap gap-1">
                    {template.category && <span className="px-1.5 py-0.5 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 rounded text-xs">{template.category}</span>}
                    <span className={`px-1.5 py-0.5 rounded text-xs ${PRIORITY_COLORS[template.priority]?.bg} ${PRIORITY_COLORS[template.priority]?.text}`}>{template.priority}</span>
                    {template.is_recurring && <span className="px-1.5 py-0.5 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 rounded text-xs">🔄 {template.recurrence_pattern}</span>}
                    {template.reminder_minutes && <span className="px-1.5 py-0.5 bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 rounded text-xs">🔔 {getReminderLabel(template.reminder_minutes)}</span>}
                  </div>
                </div>
              ))}
              {templates.length === 0 && <p className="text-center text-gray-400 text-sm py-4">No templates yet. Save one using the form above.</p>}
            </div>
          </div>
        </div>
      )}

      {/* ─── Save Template Modal ─────────────────────────────────────────────── */}
      {showSaveTemplateModal && (
        <div className="fixed inset-0 bg-black/50 z-40 flex items-center justify-center p-4" onClick={() => setShowSaveTemplateModal(false)}>
          <div role="dialog" aria-modal="true" aria-label="Save as template" className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-sm p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Save as Template</h2>
            <input type="text" value={templateName} onChange={e => setTemplateName(e.target.value)} placeholder="Template name" className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm" />
            <input type="text" value={templateDescription} onChange={e => setTemplateDescription(e.target.value)} placeholder="Description (optional)" className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm" />
            <input type="text" value={templateCategory} onChange={e => setTemplateCategory(e.target.value)} placeholder="Category (optional)" className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm" />
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowSaveTemplateModal(false)} className="px-4 py-2 text-gray-600 dark:text-gray-400 text-sm">Cancel</button>
              <button onClick={handleSaveTemplate} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium">Save Template</button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Save Filter Preset Modal ────────────────────────────────────────── */}
      {showSaveFilterModal && (
        <div className="fixed inset-0 bg-black/50 z-40 flex items-center justify-center p-4" onClick={() => setShowSaveFilterModal(false)}>
          <div role="dialog" aria-modal="true" aria-label="Save filter preset" className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-sm p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Save Filter Preset</h2>
            <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
              <p className="font-medium">Current Filters:</p>
              {searchQuery && <p>• Search: &quot;{searchQuery}&quot;</p>}
              {priorityFilter !== 'all' && <p>• Priority: {priorityFilter}</p>}
              {tagFilter !== 'all' && <p>• Tag: {tags.find(t => t.id === tagFilter)?.name}</p>}
              {completionFilter !== 'all' && <p>• Completion: {completionFilter}</p>}
              {dateFrom && <p>• Date From: {dateFrom}</p>}
              {dateTo && <p>• Date To: {dateTo}</p>}
            </div>
            <input type="text" value={filterPresetName} onChange={e => setFilterPresetName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') saveFilterPreset() }} placeholder="Preset name" className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm" />
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowSaveFilterModal(false)} className="px-4 py-2 text-gray-600 dark:text-gray-400 text-sm">Cancel</button>
              <button onClick={saveFilterPreset} className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium">Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── TodoSection Component ──────────────────────────────────────────────────

function TodoSection({ title, icon, className, children }: {
  title: string; icon?: string; className?: string; children: React.ReactNode
}) {
  return (
    <div className={`rounded-xl shadow-sm border p-4 mb-4 ${className}`}>
      <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
        {icon && <span className="mr-1">{icon}</span>}{title}
      </h2>
      <div className="space-y-2">{children}</div>
    </div>
  )
}

// ─── TodoItem Component ─────────────────────────────────────────────────────

function TodoItem({ todo, onToggle, onEdit, onDelete, expanded, onToggleExpand, newSubtaskTitle, onSubtaskTitleChange, onAddSubtask, onToggleSubtask, onDeleteSubtask }: {
  todo: Todo
  onToggle: () => void
  onEdit: () => void
  onDelete: () => void
  expanded: boolean
  onToggleExpand: () => void
  newSubtaskTitle: string
  onSubtaskTitleChange: (val: string) => void
  onAddSubtask: () => void
  onToggleSubtask: (subtask: Subtask) => void
  onDeleteSubtask: (id: string) => void
}) {
  const completedSubtasks = todo.subtasks.filter(s => s.completed).length
  const totalSubtasks = todo.subtasks.length
  const progress = totalSubtasks > 0 ? Math.round((completedSubtasks / totalSubtasks) * 100) : 0

  return (
    <div className={`p-3 rounded-lg border ${todo.completed ? 'bg-gray-50 dark:bg-gray-700/30 border-gray-200 dark:border-gray-600' : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'}`}>
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={todo.completed}
          onChange={onToggle}
          aria-label={`Mark ${todo.title} as ${todo.completed ? 'incomplete' : 'complete'}`}
          className="mt-1 w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
        />
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className={`text-sm font-medium ${todo.completed ? 'line-through text-gray-400 dark:text-gray-500' : 'text-gray-900 dark:text-white'}`}>
              {todo.title}
            </span>
            {/* Priority badge */}
            <span className={`px-1.5 py-0.5 rounded text-xs font-medium border ${PRIORITY_COLORS[todo.priority]?.bg} ${PRIORITY_COLORS[todo.priority]?.text} ${PRIORITY_COLORS[todo.priority]?.border}`}>
              {todo.priority}
            </span>
            {/* Recurring badge */}
            {todo.is_recurring && (
              <span className="px-1.5 py-0.5 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 border border-purple-200 dark:border-purple-800 rounded text-xs">
                🔄 {todo.recurrence_pattern}
              </span>
            )}
            {/* Reminder badge */}
            {todo.reminder_minutes && (
              <span className="px-1.5 py-0.5 bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 border border-orange-200 dark:border-orange-800 rounded text-xs">
                🔔 {getReminderLabel(todo.reminder_minutes)}
              </span>
            )}
            {/* Tag badges */}
            {todo.tags.map(tag => (
              <span key={tag.id} className="px-1.5 py-0.5 rounded-full text-xs font-medium text-white" style={{ backgroundColor: tag.color }}>
                {tag.name}
              </span>
            ))}
          </div>
          {/* Due date */}
          {todo.due_date && (
            <p className={`text-xs mt-0.5 ${formatDueDisplay(todo.due_date).color}`}>
              {formatDueDisplay(todo.due_date).text}
            </p>
          )}
          {/* Progress bar */}
          {totalSubtasks > 0 && (
            <div className="mt-1.5">
              <div className="flex items-center gap-2">
                <div className="flex-1 h-1.5 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
                  <div role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100} className={`h-full rounded-full transition-all ${progress === 100 ? 'bg-green-500' : 'bg-blue-500'}`} style={{ width: `${progress}%` }} />
                </div>
                <span className="text-xs text-gray-500 dark:text-gray-400">{completedSubtasks}/{totalSubtasks} subtasks</span>
              </div>
            </div>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button onClick={onToggleExpand} aria-label="Toggle subtasks" className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 px-1">
            {expanded ? '▼' : '▶'} Subtasks
          </button>
          <button onClick={onEdit} aria-label="Edit todo" className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 px-1">Edit</button>
          <button onClick={onDelete} aria-label="Delete todo" className="text-xs text-red-600 dark:text-red-400 hover:text-red-800 px-1">Delete</button>
        </div>
      </div>
      {/* Expanded subtasks */}
      {expanded && (
        <div className="mt-3 ml-7 space-y-1.5">
          {todo.subtasks.map(subtask => (
            <div key={subtask.id} className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={subtask.completed}
                onChange={() => onToggleSubtask(subtask)}
                className="w-3.5 h-3.5 rounded border-gray-300 dark:border-gray-600 text-blue-600"
              />
              <span className={`flex-1 text-sm ${subtask.completed ? 'line-through text-gray-400' : 'text-gray-700 dark:text-gray-300'}`}>
                {subtask.title}
              </span>
              <button onClick={() => onDeleteSubtask(subtask.id)} className="text-gray-400 hover:text-red-600 text-xs">✕</button>
            </div>
          ))}
          <div className="flex gap-2 mt-2">
            <input
              type="text"
              value={newSubtaskTitle}
              onChange={e => onSubtaskTitleChange(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') onAddSubtask() }}
              placeholder="Add subtask..."
              className="flex-1 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-xs"
            />
            <button onClick={onAddSubtask} className="px-2 py-1 bg-blue-600 text-white rounded text-xs">Add</button>
          </div>
        </div>
      )}
    </div>
  )
}
