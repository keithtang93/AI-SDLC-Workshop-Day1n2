"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export function useNotifications() {
  const [permission, setPermission] =
    useState<NotificationPermission>("default");
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const requestPermission = useCallback(async () => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      return;
    }

    const value = await Notification.requestPermission();
    setPermission(value);
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      setPermission(Notification.permission);
    }
  }, []);

  useEffect(() => {
    if (permission !== "granted") {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      return;
    }

    const poll = async () => {
      const response = await fetch("/api/notifications/check");
      if (!response.ok) {
        return;
      }
      const data = await response.json();
      for (const item of data.notifications ?? []) {
        new Notification(`Reminder: ${item.title}`, {
          body: item.due_date
            ? `Due at ${new Date(item.due_date).toLocaleString()}`
            : "Upcoming task due",
          tag: `todo-${item.id}`,
        });
      }
    };

    poll();
    timerRef.current = setInterval(poll, 60000);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [permission]);

  return {
    permission,
    requestPermission,
  };
}
