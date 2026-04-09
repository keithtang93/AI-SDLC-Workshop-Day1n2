'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'

interface Todo {
  id: string
  title: string
  priority: string
  due_date: string | null
  completed: boolean
}

interface Holiday {
  id: number
  date: string
  name: string
}

const PRIORITY_BG: Record<string, string> = {
  high: 'bg-red-500',
  medium: 'bg-yellow-500',
  low: 'bg-blue-500',
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function getCalendarDays(year: number, month: number): (Date | null)[][] {
  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)
  const startPadding = firstDay.getDay()
  const totalDays = lastDay.getDate()

  const days: (Date | null)[] = []
  for (let i = 0; i < startPadding; i++) days.push(null)
  for (let d = 1; d <= totalDays; d++) days.push(new Date(year, month, d))
  while (days.length % 7 !== 0) days.push(null)

  const weeks: (Date | null)[][] = []
  for (let i = 0; i < days.length; i += 7) {
    weeks.push(days.slice(i, i + 7))
  }
  return weeks
}

function formatDateKey(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export default function CalendarPage() {
  const router = useRouter()

  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth())

  const [todos, setTodos] = useState<Todo[]>([])
  const [holidays, setHolidays] = useState<Holiday[]>([])
  const [user, setUser] = useState<{ username: string } | null>(null)
  const [selectedDate, setSelectedDate] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/auth/me').then(res => {
      if (!res.ok) throw new Error()
      return res.json()
    }).then(setUser).catch(() => router.push('/login'))
  }, [router])

  const fetchData = useCallback(async () => {
    try {
      const [todosRes, holidaysRes] = await Promise.all([
        fetch('/api/todos'),
        fetch(`/api/holidays?year=${year}`),
      ])
      if (todosRes.ok) setTodos(await todosRes.json())
      if (holidaysRes.ok) setHolidays(await holidaysRes.json())
    } catch {
      // ignore
    }
  }, [year])

  useEffect(() => {
    if (user) fetchData()
  }, [user, fetchData])

  // Group todos by date
  const todosByDate = useMemo(() => {
    const map: Record<string, Todo[]> = {}
    for (const todo of todos) {
      if (!todo.due_date) continue
      const d = new Date(todo.due_date)
      const key = formatDateKey(d)
      if (!map[key]) map[key] = []
      map[key].push(todo)
    }
    return map
  }, [todos])

  const holidaysByDate = useMemo(() => {
    const map: Record<string, string[]> = {}
    for (const h of holidays) {
      if (!map[h.date]) map[h.date] = []
      map[h.date].push(h.name)
    }
    return map
  }, [holidays])

  const weeks = useMemo(() => getCalendarDays(year, month), [year, month])
  const today = formatDateKey(now)
  const monthName = new Date(year, month).toLocaleString('en-SG', { month: 'long', year: 'numeric' })

  function prevMonth() {
    if (month === 0) { setMonth(11); setYear(y => y - 1) }
    else setMonth(m => m - 1)
  }

  function nextMonth() {
    if (month === 11) { setMonth(0); setYear(y => y + 1) }
    else setMonth(m => m + 1)
  }

  function goToday() {
    setYear(now.getFullYear())
    setMonth(now.getMonth())
  }

  if (!user) return null

  const selectedTodos = selectedDate ? (todosByDate[selectedDate] || []) : []
  const selectedHolidays = selectedDate ? (holidaysByDate[selectedDate] || []) : []

  return (
    <div role="main" aria-label="Calendar view" className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      <div className="max-w-5xl mx-auto p-4 sm:p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Calendar</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">{user.username}</p>
          </div>
          <button onClick={() => router.push('/')} className="px-3 py-1.5 bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400 rounded-lg text-sm font-medium">
            ← Back to Todos
          </button>
        </div>

        {/* Calendar */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
          {/* Month navigation */}
          <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
            <button onClick={prevMonth} aria-label="Previous month" className="px-3 py-1.5 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded text-sm">◀</button>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{monthName}</h2>
              <button onClick={goToday} aria-label="Go to today" className="px-2 py-1 bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400 rounded text-xs">Today</button>
            </div>
            <button onClick={nextMonth} aria-label="Next month" className="px-3 py-1.5 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded text-sm">▶</button>
          </div>

          {/* Day headers */}
          <div className="grid grid-cols-7">
            {DAY_NAMES.map(day => (
              <div key={day} className="p-2 text-center text-xs font-semibold text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                {day}
              </div>
            ))}
          </div>

          {/* Calendar grid */}
          <div role="grid" aria-label="Calendar">
          {weeks.map((week, wi) => (
            <div key={wi} className="grid grid-cols-7">
              {week.map((day, di) => {
                if (!day) {
                  return <div key={di} className="p-2 min-h-[80px] border-b border-r border-gray-100 dark:border-gray-700/50 bg-gray-50 dark:bg-gray-900/20" />
                }

                const dateKey = formatDateKey(day)
                const isToday = dateKey === today
                const isWeekend = day.getDay() === 0 || day.getDay() === 6
                const dayTodos = todosByDate[dateKey] || []
                const dayHolidays = holidaysByDate[dateKey] || []

                return (
                  <div
                    key={di}
                    onClick={() => setSelectedDate(dateKey)}
                    className={`p-2 min-h-[80px] border-b border-r border-gray-100 dark:border-gray-700/50 cursor-pointer hover:bg-blue-50 dark:hover:bg-gray-700/50 transition-colors ${
                      isWeekend ? 'bg-gray-50 dark:bg-gray-900/10' : ''
                    } ${isToday ? 'ring-2 ring-inset ring-blue-500' : ''}`}
                  >
                    <div className={`text-xs font-medium mb-1 ${isToday ? 'text-blue-600 dark:text-blue-400 font-bold' : 'text-gray-700 dark:text-gray-300'}`}>
                      {day.getDate()}
                      {dayTodos.length > 0 && (
                        <span className="ml-1 px-1 py-0.5 bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400 rounded-full text-[10px]">
                          {dayTodos.length}
                        </span>
                      )}
                    </div>
                    {dayHolidays.map((name, i) => (
                      <div key={i} className="text-[10px] text-red-600 dark:text-red-400 truncate mb-0.5">{name}</div>
                    ))}
                    {dayTodos.slice(0, 3).map(todo => (
                      <div key={todo.id} className="flex items-center gap-1 mb-0.5">
                        <div className={`w-1.5 h-1.5 rounded-full ${PRIORITY_BG[todo.priority] || 'bg-gray-400'}`} />
                        <span className={`text-[10px] truncate ${todo.completed ? 'line-through text-gray-400' : 'text-gray-700 dark:text-gray-300'}`}>{todo.title}</span>
                      </div>
                    ))}
                    {dayTodos.length > 3 && (
                      <div className="text-[10px] text-gray-400">+{dayTodos.length - 3} more</div>
                    )}
                  </div>
                )
              })}
            </div>
          ))}
          </div>
        </div>
      </div>

      {/* Day detail modal */}
      {selectedDate && (
        <div className="fixed inset-0 bg-black/50 z-40 flex items-center justify-center p-4" onClick={() => setSelectedDate(null)}>
          <div role="dialog" aria-modal="true" aria-label="Day details" className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                {new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-SG', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
              </h2>
              <button onClick={() => setSelectedDate(null)} className="text-gray-400 hover:text-gray-600 text-lg">✕</button>
            </div>
            {selectedHolidays.length > 0 && (
              <div className="space-y-1">
                {selectedHolidays.map((name, i) => (
                  <div key={i} className="text-sm text-red-600 dark:text-red-400">🎉 {name}</div>
                ))}
              </div>
            )}
            {selectedTodos.length > 0 ? (
              <div className="space-y-2">
                {selectedTodos.map(todo => (
                  <div key={todo.id} className="flex items-center gap-2 p-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                    <div className={`w-2 h-2 rounded-full ${PRIORITY_BG[todo.priority] || 'bg-gray-400'}`} />
                    <span className={`text-sm ${todo.completed ? 'line-through text-gray-400' : 'text-gray-900 dark:text-white'}`}>{todo.title}</span>
                    <span className={`text-xs px-1 py-0.5 rounded ${todo.completed ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'}`}>
                      {todo.completed ? 'Done' : 'Pending'}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-4">No todos for this date</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
