"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";

interface TodoLite {
  id: number;
  title: string;
  due_date: string | null;
  completed: number;
  priority: string;
}

interface Holiday {
  id: number;
  date: string;
  name: string;
}

function monthKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function parseMonthParam(param: string | null): Date | null {
  if (!param) return null;
  const match = param.match(/^(\d{4})-(\d{2})$/);
  if (!match) return null;
  const y = Number(match[1]);
  const m = Number(match[2]) - 1;
  if (m < 0 || m > 11) return null;
  return new Date(y, m, 1);
}

const priorityColors: Record<string, string> = {
  high: "text-red-600",
  medium: "text-yellow-600",
  low: "text-blue-600",
};

export default function CalendarPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto max-w-6xl p-6">
          <p>Loading calendar...</p>
        </main>
      }
    >
      <CalendarContent />
    </Suspense>
  );
}

function CalendarContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const initialDate = parseMonthParam(searchParams.get("month")) ?? new Date();
  const [focus, setFocus] = useState<Date>(initialDate);
  const [todos, setTodos] = useState<TodoLite[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  const updateFocus = (newDate: Date) => {
    setFocus(newDate);
    router.push(`/calendar?month=${monthKey(newDate)}`, { scroll: false });
  };

  useEffect(() => {
    const load = async () => {
      const todosRes = await fetch("/api/todos");
      if (todosRes.ok) {
        const data = await todosRes.json();
        setTodos(data.todos ?? []);
      }

      const start = new Date(focus.getFullYear(), focus.getMonth(), 1)
        .toISOString()
        .slice(0, 10);
      const end = new Date(focus.getFullYear(), focus.getMonth() + 1, 0)
        .toISOString()
        .slice(0, 10);
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
    const withPad = [
      ...Array.from({ length: lead }).map(() => null),
      ...values,
    ] as Array<Date | null>;
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

  const selectedDayTodos = selectedDay ? (todoMap.get(selectedDay) ?? []) : [];
  const selectedDayHoliday = selectedDay
    ? holidayMap.get(selectedDay)
    : undefined;

  return (
    <main className="mx-auto max-w-6xl p-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Calendar</h1>
        <div className="flex gap-2">
          <Link href="/" className="rounded bg-slate-200 px-3 py-2 text-sm">
            Back to Todos
          </Link>
          <button
            className="rounded bg-slate-900 px-3 py-2 text-sm text-white"
            onClick={() => updateFocus(new Date())}
          >
            Today
          </button>
          <button
            className="rounded bg-slate-200 px-3 py-2 text-sm"
            onClick={() =>
              updateFocus(
                new Date(focus.getFullYear(), focus.getMonth() - 1, 1),
              )
            }
          >
            Prev
          </button>
          <button
            className="rounded bg-slate-200 px-3 py-2 text-sm"
            onClick={() =>
              updateFocus(
                new Date(focus.getFullYear(), focus.getMonth() + 1, 1),
              )
            }
          >
            Next
          </button>
        </div>
      </div>

      <h2 className="mb-3 text-xl font-semibold">
        {focus.toLocaleString("en-SG", { month: "long", year: "numeric" })}
      </h2>

      <div className="grid grid-cols-7 gap-2 text-center text-sm font-medium text-slate-600">
        <div>Sun</div>
        <div>Mon</div>
        <div>Tue</div>
        <div>Wed</div>
        <div>Thu</div>
        <div>Fri</div>
        <div>Sat</div>
      </div>

      <div className="mt-2 grid grid-cols-7 gap-2">
        {days.map((day, idx) => {
          if (!day) {
            return (
              <div
                key={idx}
                className="h-28 rounded border border-transparent bg-transparent"
              />
            );
          }

          const key = day.toISOString().slice(0, 10);
          const dayTodos = todoMap.get(key) ?? [];
          const holiday = holidayMap.get(key);
          const isToday = key === new Date().toISOString().slice(0, 10);
          const isWeekend = day.getDay() === 0 || day.getDay() === 6;

          return (
            <div
              key={idx}
              onClick={() => setSelectedDay(key)}
              className={`h-28 cursor-pointer rounded border p-2 shadow-sm transition hover:ring-2 hover:ring-slate-300 ${
                isToday
                  ? "border-blue-400 bg-blue-50"
                  : isWeekend
                    ? "bg-slate-50"
                    : "bg-white"
              }`}
            >
              <div className="flex items-start justify-between">
                <span
                  className={`text-sm font-semibold ${isToday ? "text-blue-600" : ""}`}
                >
                  {day.getDate()}
                </span>
                {holiday && <span title={holiday.name}>🇸🇬</span>}
              </div>
              {dayTodos.length > 0 && (
                <p className="mt-1 text-xs font-medium text-slate-700">
                  {dayTodos.length} todo{dayTodos.length > 1 ? "s" : ""}
                </p>
              )}
              {holiday && (
                <p className="text-xs text-rose-600">{holiday.name}</p>
              )}
            </div>
          );
        })}
      </div>

      <p className="mt-4 text-sm text-slate-500">
        Current month key: {monthKey(focus)}
      </p>

      {/* Day Detail Modal */}
      {selectedDay && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="mx-4 w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold">
                {new Date(selectedDay + "T00:00:00").toLocaleDateString(
                  "en-SG",
                  {
                    weekday: "long",
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  },
                )}
              </h2>
              <button
                className="rounded bg-slate-200 px-3 py-1 text-sm"
                onClick={() => setSelectedDay(null)}
              >
                Close
              </button>
            </div>
            {selectedDayHoliday && (
              <p className="mb-3 rounded bg-rose-50 px-3 py-2 text-sm text-rose-700">
                🇸🇬 {selectedDayHoliday.name}
              </p>
            )}
            {selectedDayTodos.length === 0 ? (
              <p className="text-sm text-slate-500">
                No todos scheduled for this day.
              </p>
            ) : (
              <ul className="space-y-2">
                {selectedDayTodos.map((todo) => (
                  <li
                    key={todo.id}
                    className="flex items-center gap-2 rounded border p-2"
                  >
                    <span
                      className={`text-sm ${todo.completed ? "line-through text-slate-400" : ""}`}
                    >
                      {todo.title}
                    </span>
                    <span
                      className={`ml-auto text-xs font-medium ${priorityColors[todo.priority] ?? ""}`}
                    >
                      {todo.priority}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
