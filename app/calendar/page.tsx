'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

interface TodoLite {
  id: number;
  title: string;
  due_date: string | null;
  completed: number;
}

interface Holiday {
  id: number;
  date: string;
  name: string;
}

function monthKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

export default function CalendarPage() {
  const [focus, setFocus] = useState<Date>(new Date());
  const [todos, setTodos] = useState<TodoLite[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);

  useEffect(() => {
    const load = async () => {
      const todosRes = await fetch('/api/todos');
      if (todosRes.ok) {
        const data = await todosRes.json();
        setTodos(data.todos ?? []);
      }

      const start = new Date(focus.getFullYear(), focus.getMonth(), 1).toISOString().slice(0, 10);
      const end = new Date(focus.getFullYear(), focus.getMonth() + 1, 0).toISOString().slice(0, 10);
      const holidayRes = await fetch(`/api/holidays?start=${start}&end=${end}`);
      if (holidayRes.ok) {
        const data = await holidayRes.json();
        setHolidays(data.holidays ?? []);
      }
    };

    load();
  }, [focus]);

  const days = useMemo(() => {
    const y = focus.getFullYear();
    const m = focus.getMonth();
    const start = new Date(y, m, 1);
    const end = new Date(y, m + 1, 0);
    const values: Date[] = [];
    for (let i = 1; i <= end.getDate(); i += 1) {
      values.push(new Date(y, m, i));
    }
    const lead = start.getDay();
    const withPad = [...Array.from({ length: lead }).map(() => null), ...values] as Array<Date | null>;
    while (withPad.length % 7 !== 0) {
      withPad.push(null);
    }
    return withPad;
  }, [focus]);

  const todoMap = useMemo(() => {
    const map = new Map<string, TodoLite[]>();
    for (const todo of todos) {
      if (!todo.due_date) {
        continue;
      }
      const key = todo.due_date.slice(0, 10);
      const list = map.get(key) ?? [];
      list.push(todo);
      map.set(key, list);
    }
    return map;
  }, [todos]);

  const holidayMap = useMemo(() => {
    const map = new Map<string, Holiday>();
    for (const holiday of holidays) {
      map.set(holiday.date, holiday);
    }
    return map;
  }, [holidays]);

  return (
    <main className="mx-auto max-w-6xl p-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Calendar</h1>
        <div className="flex gap-2">
          <Link href="/" className="rounded bg-slate-200 px-3 py-2 text-sm">Back to Todos</Link>
          <button className="rounded bg-slate-900 px-3 py-2 text-sm text-white" onClick={() => setFocus(new Date())}>Today</button>
          <button className="rounded bg-slate-200 px-3 py-2 text-sm" onClick={() => setFocus(new Date(focus.getFullYear(), focus.getMonth() - 1, 1))}>Prev</button>
          <button className="rounded bg-slate-200 px-3 py-2 text-sm" onClick={() => setFocus(new Date(focus.getFullYear(), focus.getMonth() + 1, 1))}>Next</button>
        </div>
      </div>

      <h2 className="mb-3 text-xl font-semibold">{focus.toLocaleString('en-SG', { month: 'long', year: 'numeric' })}</h2>

      <div className="grid grid-cols-7 gap-2 text-center text-sm font-medium text-slate-600">
        <div>Sun</div><div>Mon</div><div>Tue</div><div>Wed</div><div>Thu</div><div>Fri</div><div>Sat</div>
      </div>

      <div className="mt-2 grid grid-cols-7 gap-2">
        {days.map((day, idx) => {
          if (!day) {
            return <div key={idx} className="h-28 rounded border border-transparent bg-transparent" />;
          }

          const key = day.toISOString().slice(0, 10);
          const dayTodos = todoMap.get(key) ?? [];
          const holiday = holidayMap.get(key);

          return (
            <div key={idx} className="h-28 rounded border bg-white p-2 shadow-sm">
              <div className="flex items-start justify-between">
                <span className="text-sm font-semibold">{day.getDate()}</span>
                {holiday && <span title={holiday.name}>🇸🇬</span>}
              </div>
              <p className="mt-2 text-xs text-slate-500">{dayTodos.length} todos</p>
              {holiday && <p className="text-xs text-rose-600">{holiday.name}</p>}
            </div>
          );
        })}
      </div>

      <p className="mt-4 text-sm text-slate-500">Current month key: {monthKey(focus)}</p>
    </main>
  );
}
