'use client'

import { useEffect, useRef, useState, useCallback } from 'react'

interface DueReminder {
  id: number
  title: string
  due_date: string
}

export function useNotifications() {
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>('default')
  const sentIdsRef = useRef<Set<number>>(new Set())
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      setPermission('unsupported')
      return
    }
    setPermission(Notification.permission)
  }, [])

  const requestPermission = useCallback(async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) return
    const result = await Notification.requestPermission()
    setPermission(result)
  }, [])

  const checkAndNotify = useCallback(async () => {
    try {
      const res = await fetch('/api/notifications/check')
      if (!res.ok) return
      const reminders: DueReminder[] = await res.json()
      for (const r of reminders) {
        if (!sentIdsRef.current.has(r.id)) {
          sentIdsRef.current.add(r.id)
          new Notification('Todo Reminder', {
            body: `${r.title} is due at ${new Date(r.due_date).toLocaleString('en-SG', { timeZone: 'Asia/Singapore' })}`,
            icon: '/favicon.ico',
          })
        }
      }
    } catch {
      // ignore network errors silently
    }
  }, [])

  useEffect(() => {
    if (permission !== 'granted') {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
      return
    }

    checkAndNotify()
    intervalRef.current = setInterval(checkAndNotify, 30000)

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [permission, checkAndNotify])

  return { permission, requestPermission }
}
