'use client'

import { useState, useEffect, useCallback, useRef } from 'react'

interface DueTodo {
  id: string
  title: string
  due_date: string
  reminder_minutes: number
}

export function useNotifications() {
  const [enabled, setEnabled] = useState(false)
  const [permission, setPermission] = useState<NotificationPermission>('default')
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setPermission(Notification.permission)
      setEnabled(Notification.permission === 'granted')
    }
  }, [])

  const requestPermission = useCallback(async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) return false

    const result = await Notification.requestPermission()
    setPermission(result)
    setEnabled(result === 'granted')
    return result === 'granted'
  }, [])

  const checkReminders = useCallback(async () => {
    if (!enabled) return

    try {
      const res = await fetch('/api/notifications/check')
      if (!res.ok) return

      const dueTodos = (await res.json()) as DueTodo[]

      for (const todo of dueTodos) {
        new Notification('Todo Reminder', {
          body: `${todo.title} is due soon!`,
          icon: '/favicon.ico',
          tag: `todo-${todo.id}`,
        })

        // Mark notification as sent
        await fetch(`/api/todos/${todo.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ lastNotificationSent: new Date().toISOString() }),
        })
      }
    } catch {
      // Silently fail notification checks
    }
  }, [enabled])

  useEffect(() => {
    if (!enabled) return

    // Check immediately
    checkReminders()

    // Poll every 30 seconds
    intervalRef.current = setInterval(checkReminders, 30000)

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [enabled, checkReminders])

  return { enabled, permission, requestPermission }
}
