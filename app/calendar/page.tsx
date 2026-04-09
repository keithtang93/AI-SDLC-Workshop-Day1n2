'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'

interface Todo {
  id: number
  title: string
  completed: boolean
  priority: string
  due_date: string | null
  is_recurring: boolean
  recurrence_pattern: string | null
  subtasks: Array<{ id: number; title: string; completed: boolean }>
  tags: Array<{ id: number; name: string; color: string }>
}

interface Holiday {
  id: number
  name: string
  date: string
  year: number
}

const PRIORITY_COLORS: Record<string, string> = {
  high: 'bg-red-500',
  medium: 'bg-amber-500',
  low: 'bg-blue-500',
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function getSingaporeToday(): { year: number; month: number; day: number } {
  const now = new Date()
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Singapore',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now)
  return {
    year: parseInt(parts.find(p => p.type === 'year')?.value ?? '2026'),
    month: parseInt(parts.find(p => p.type === 'month')?.value ?? '1'),
    day: parseInt(parts.find(p => p.type === 'day')?.value ?? '1'),
  }
}

function parseMonthParam(param: string | null): { year: number; month: number } | null {
  if (!param) return null
  const match = param.match(/^(\d{4})-(\d{2})$/)
  if (!match) return null
  const year = parseInt(match[1])
  const month = parseInt(match[2])
  if (month < 1 || month > 12 || year < 1900 || year > 2100) return null
  return { year, month }
}

function getMonthGrid(year: number, month: number): Array<{ date: number; inMonth: boolean; dateStr: string }[]> {
  const firstDay = new Date(year, month - 1, 1).getDay()
  const daysInMonth = new Date(year, month, 0).getDate()
  const daysInPrevMonth = new Date(year, month - 1, 0).getDate()

  const cells: Array<{ date: number; inMonth: boolean; dateStr: string }> = []

  // Previous month trailing days
  for (let i = firstDay - 1; i >= 0; i--) {
    const d = daysInPrevMonth - i
    const m = month - 1
    const y = m < 1 ? year - 1 : year
    const actualM = m < 1 ? 12 : m
    cells.push({ date: d, inMonth: false, dateStr: `${y}-${String(actualM).padStart(2, '0')}-${String(d).padStart(2, '0')}` })
  }

  // Current month days
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ date: d, inMonth: true, dateStr: `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}` })
  }

  // Next month leading days
  const remaining = 7 - (cells.length % 7)
  if (remaining < 7) {
    for (let d = 1; d <= remaining; d++) {
      const m = month + 1
      const y = m > 12 ? year + 1 : year
      const actualM = m > 12 ? 1 : m
      cells.push({ date: d, inMonth: false, dateStr: `${y}-${String(actualM).padStart(2, '0')}-${String(d).padStart(2, '0')}` })
    }
  }

  // Split into weeks
  const weeks: typeof cells[] = []
  for (let i = 0; i < cells.length; i += 7) {
    weeks.push(cells.slice(i, i + 7))
  }
  return weeks
}

function todoDueDateStr(todo: Todo): string | null {
  if (!todo.due_date) return null
  const d = new Date(todo.due_date)
  // Convert to Singapore timezone date
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Singapore',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(d)
  const y = parts.find(p => p.type === 'year')?.value
  const m = parts.find(p => p.type === 'month')?.value
  const dy = parts.find(p => p.type === 'day')?.value
  return `${y}-${m}-${dy}`
}

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

export default function CalendarPage() {
  const sgToday = getSingaporeToday()
  const [year, setYear] = useState(sgToday.year)
  const [month, setMonth] = useState(sgToday.month)
  const [todos, setTodos] = useState<Todo[]>([])
  const [holidays, setHolidays] = useState<Holiday[]>([])
  const [selectedDay, setSelectedDay] = useState<string | null>(null)
  const [darkMode, setDarkMode] = useState(false)
  const [loading, setLoading] = useState(true)

  // Read month from URL on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const parsed = parseMonthParam(params.get('month'))
    if (parsed) {
      setYear(parsed.year)
      setMonth(parsed.month)
    }
  }, [])

  // Dark mode
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
      if (next) document.documentElement.classList.add('dark')
      else document.documentElement.classList.remove('dark')
      localStorage.setItem('darkMode', String(next))
      return next
    })
  }, [])

  // Fetch data
  const fetchData = useCallback(async () => {
    try {
      const [todosRes, holidaysRes] = await Promise.all([
        fetch('/api/todos'),
        fetch(`/api/holidays?year=${year}&month=${month}`),
      ])
      if (todosRes.ok) setTodos(await todosRes.json())
      if (holidaysRes.ok) setHolidays(await holidaysRes.json())
    } catch { /* noop */ }
    setLoading(false)
  }, [year, month])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Update URL when month changes
  useEffect(() => {
    const monthStr = `${year}-${String(month).padStart(2, '0')}`
    const url = new URL(window.location.href)
    url.searchParams.set('month', monthStr)
    window.history.replaceState({}, '', url.toString())
  }, [year, month])

  function goToPrevMonth() {
    if (month === 1) { setYear(y => y - 1); setMonth(12) }
    else setMonth(m => m - 1)
  }

  function goToNextMonth() {
    if (month === 12) { setYear(y => y + 1); setMonth(1) }
    else setMonth(m => m + 1)
  }

  function goToToday() {
    const today = getSingaporeToday()
    setYear(today.year)
    setMonth(today.month)
  }

  const grid = getMonthGrid(year, month)
  const todayStr = `${sgToday.year}-${String(sgToday.month).padStart(2, '0')}-${String(sgToday.day).padStart(2, '0')}`

  // Build lookup maps
  const todosByDate = new Map<string, Todo[]>()
  for (const todo of todos) {
    const ds = todoDueDateStr(todo)
    if (ds) {
      if (!todosByDate.has(ds)) todosByDate.set(ds, [])
      todosByDate.get(ds)!.push(todo)
    }
  }

  const holidaysByDate = new Map<string, Holiday[]>()
  for (const h of holidays) {
    if (!holidaysByDate.has(h.date)) holidaysByDate.set(h.date, [])
    holidaysByDate.get(h.date)!.push(h)
  }

  const selectedTodos = selectedDay ? (todosByDate.get(selectedDay) || []) : []
  const selectedHolidays = selectedDay ? (holidaysByDate.get(selectedDay) || []) : []

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-gray-500 dark:text-gray-400 text-lg">Loading...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors">
      <a href="#calendar-content" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:top-2 focus:left-2 focus:px-4 focus:py-2 focus:bg-blue-600 focus:text-white focus:rounded-lg">Skip to main content</a>
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">📅 Calendar View</h1>
          <div className="flex items-center gap-3">
            <Link href="/" className="text-sm px-3 py-1.5 bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 rounded-lg hover:bg-blue-200 dark:hover:bg-blue-900/60 transition">
              ← Back to Todos
            </Link>
            <button onClick={toggleDarkMode} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition" aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}>
              {darkMode ? '☀️' : '🌙'}
            </button>
          </div>
        </div>
      </header>

      <main id="calendar-content" className="max-w-5xl mx-auto px-4 py-6">
        {/* Month Navigation */}
        <div className="flex items-center justify-between mb-4">
          <button onClick={goToPrevMonth} className="px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition" aria-label="Previous month">
            ← Prev
          </button>
          <div className="text-center">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              {MONTH_NAMES[month - 1]} {year}
            </h2>
          </div>
          <div className="flex gap-2">
            <button onClick={goToToday} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition" aria-label="Go to today">
              Today
            </button>
            <button onClick={goToNextMonth} className="px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition" aria-label="Next month">
              Next →
            </button>
          </div>
        </div>

        {/* Calendar Grid */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
          {/* Day headers */}
          <div className="grid grid-cols-7">
            {DAY_NAMES.map((name, i) => (
              <div key={name} className={`py-2 text-center text-sm font-semibold border-b border-gray-200 dark:border-gray-700 ${i === 0 || i === 6 ? 'text-red-500 dark:text-red-400 bg-red-50/50 dark:bg-red-900/10' : 'text-gray-500 dark:text-gray-400'}`}>
                {name}
              </div>
            ))}
          </div>

          {/* Week rows */}
          {grid.map((week, wi) => (
            <div key={wi} className="grid grid-cols-7">
              {week.map((cell, ci) => {
                const isToday = cell.dateStr === todayStr
                const isWeekend = ci === 0 || ci === 6
                const dayTodos = todosByDate.get(cell.dateStr) || []
                const dayHolidays = holidaysByDate.get(cell.dateStr) || []
                const isSelected = selectedDay === cell.dateStr

                return (
                  <div
                    key={cell.dateStr}
                    role="button"
                    tabIndex={0}
                    onClick={() => setSelectedDay(cell.dateStr)}
                    onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedDay(cell.dateStr) } }}
                    aria-label={`${cell.date} ${cell.inMonth ? '' : '(other month)'} ${dayHolidays.map(h => h.name).join(', ')} ${dayTodos.length ? dayTodos.length + ' todos' : ''}`}
                    className={`min-h-[80px] p-1.5 border-b border-r border-gray-200 dark:border-gray-700 cursor-pointer transition hover:bg-blue-50 dark:hover:bg-blue-900/20 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500 ${
                      !cell.inMonth ? 'bg-gray-50 dark:bg-gray-900/50' : isWeekend ? 'bg-red-50/30 dark:bg-red-900/5' : ''
                    } ${isSelected ? 'ring-2 ring-inset ring-blue-500' : ''}`}
                  >
                    <div className={`text-sm font-medium mb-1 ${
                      isToday
                        ? 'bg-blue-600 text-white w-6 h-6 rounded-full flex items-center justify-center'
                        : !cell.inMonth
                          ? 'text-gray-300 dark:text-gray-600'
                          : isWeekend
                            ? 'text-red-500 dark:text-red-400'
                            : 'text-gray-700 dark:text-gray-300'
                    }`}>
                      {cell.date}
                    </div>

                    {/* Holiday badges */}
                    {dayHolidays.map(h => (
                      <div key={h.id} className="text-[10px] px-1 py-0.5 mb-0.5 rounded bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300 truncate" title={h.name}>
                        🎉 {h.name}
                      </div>
                    ))}

                    {/* Todo indicators */}
                    {dayTodos.slice(0, 3).map(todo => (
                      <div key={todo.id} className="flex items-center gap-1 mb-0.5">
                        <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${PRIORITY_COLORS[todo.priority] || 'bg-gray-400'} ${todo.completed ? 'opacity-50' : ''}`} />
                        <span className={`text-[10px] truncate ${todo.completed ? 'line-through text-gray-400 dark:text-gray-500' : 'text-gray-700 dark:text-gray-300'}`}>
                          {todo.title}
                        </span>
                      </div>
                    ))}
                    {dayTodos.length > 3 && (
                      <span className="text-[10px] text-gray-400 dark:text-gray-500">+{dayTodos.length - 3} more</span>
                    )}
                  </div>
                )
              })}
            </div>
          ))}
        </div>

        {/* Day detail panel */}
        {selectedDay && (
          <div className="mt-6 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {new Date(selectedDay + 'T12:00:00').toLocaleDateString('en-SG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
              </h3>
              <button onClick={() => setSelectedDay(null)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition" aria-label="Close day detail">✕</button>
            </div>

            {/* Holidays for selected day */}
            {selectedHolidays.length > 0 && (
              <div className="mb-4">
                {selectedHolidays.map(h => (
                  <div key={h.id} className="px-3 py-2 mb-2 rounded-lg bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800">
                    <span className="text-sm text-orange-700 dark:text-orange-300">🎉 {h.name}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Todos for selected day */}
            {selectedTodos.length === 0 ? (
              <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-4">No todos due on this day</p>
            ) : (
              <div className="space-y-2">
                {selectedTodos.map(todo => (
                  <div key={todo.id} className={`p-3 rounded-lg border ${todo.completed ? 'bg-gray-50 dark:bg-gray-700/30 border-gray-200 dark:border-gray-700 opacity-70' : 'bg-white dark:bg-gray-700/50 border-gray-200 dark:border-gray-600'}`}>
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${PRIORITY_COLORS[todo.priority] || 'bg-gray-400'}`} />
                      <span className={`font-medium text-sm ${todo.completed ? 'line-through text-gray-400 dark:text-gray-500' : 'text-gray-900 dark:text-white'}`}>
                        {todo.title}
                      </span>
                      <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                        todo.priority === 'high' ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300' :
                        todo.priority === 'low' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' :
                        'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
                      }`}>{todo.priority}</span>
                      {todo.is_recurring && <span className="text-xs">🔄</span>}
                      {todo.completed && <span className="text-xs">✅</span>}
                    </div>
                    {todo.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {todo.tags.map(tag => (
                          <span key={tag.id} className="px-2 py-0.5 rounded-full text-[10px] font-medium text-white" style={{ backgroundColor: tag.color }}>
                            {tag.name}
                          </span>
                        ))}
                      </div>
                    )}
                    {todo.subtasks.length > 0 && (
                      <div className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
                        {todo.subtasks.filter(s => s.completed).length}/{todo.subtasks.length} subtasks done
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  )
}
