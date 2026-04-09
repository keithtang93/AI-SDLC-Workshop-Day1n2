'use client';

import Link from 'next/link';
import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from 'react';
import { useNotifications } from '@/lib/hooks/useNotifications';

type Priority = 'high' | 'medium' | 'low';
type RecurrencePattern = 'daily' | 'weekly' | 'monthly' | 'yearly';

interface Tag {
  id: number;
  name: string;
  color: string;
}

interface Subtask {
  id: number;
  title: string;
  completed: number;
}

interface Todo {
  id: number;
  title: string;
  description: string | null;
  priority: Priority;
  due_date: string | null;
  completed: number;
  reminder_minutes: number | null;
  recurrence_pattern: RecurrencePattern | null;
  tags: Tag[];
  subtasks: Subtask[];
}

interface Template {
  id: number;
  name: string;
}

const reminderOptions = [
  { label: 'None', value: '' },
  { label: '15 minutes before', value: '15' },
  { label: '30 minutes before', value: '30' },
  { label: '1 hour before', value: '60' },
  { label: '2 hours before', value: '120' },
  { label: '1 day before', value: '1440' },
  { label: '2 days before', value: '2880' },
  { label: '1 week before', value: '10080' }
];

function progress(todo: Todo): { completed: number; total: number; percent: number } {
  const total = todo.subtasks.length;
  const completed = todo.subtasks.filter((item) => item.completed === 1).length;
  const percent = total === 0 ? 0 : Math.round((completed / total) * 100);
  return { completed, total, percent };
}

export default function HomePage() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<Priority>('medium');
  const [dueDate, setDueDate] = useState('');
  const [recurrence, setRecurrence] = useState<RecurrencePattern | ''>('');
  const [reminderMinutes, setReminderMinutes] = useState('');
  const [selectedTags, setSelectedTags] = useState<number[]>([]);

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<'all' | 'incomplete' | 'complete'>('all');
  const [priorityFilter, setPriorityFilter] = useState<'all' | Priority>('all');
  const [tagFilter, setTagFilter] = useState<number | null>(null);

  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState('#3B82F6');

  const [newTemplateName, setNewTemplateName] = useState('');

  const { permission, requestPermission } = useNotifications();

  const loadAll = async () => {
    const [todoRes, tagRes, templateRes] = await Promise.all([
      fetch('/api/todos'),
      fetch('/api/tags'),
      fetch('/api/templates')
    ]);

    if (!todoRes.ok) {
      setError('Unable to load todos. Try logging in again.');
      return;
    }

    const todoData = await todoRes.json();
    const tagData = tagRes.ok ? await tagRes.json() : { tags: [] };
    const templateData = templateRes.ok ? await templateRes.json() : { templates: [] };

    setTodos(todoData.todos ?? []);
    setTags(tagData.tags ?? []);
    setTemplates(templateData.templates ?? []);
  };

  useEffect(() => {
    loadAll();
  }, []);

  const filteredTodos = useMemo(() => {
    const query = search.toLowerCase();
    return todos.filter((todo) => {
      if (status === 'complete' && todo.completed !== 1) return false;
      if (status === 'incomplete' && todo.completed === 1) return false;
      if (priorityFilter !== 'all' && todo.priority !== priorityFilter) return false;
      if (tagFilter && !todo.tags.some((tag) => tag.id === tagFilter)) return false;

      if (!query) return true;
      const titleMatch = todo.title.toLowerCase().includes(query);
      const subtaskMatch = todo.subtasks.some((subtask) => subtask.title.toLowerCase().includes(query));
      return titleMatch || subtaskMatch;
    });
  }, [todos, search, status, priorityFilter, tagFilter]);

  const grouped = useMemo(() => {
    const overdue: Todo[] = [];
    const active: Todo[] = [];
    const completed: Todo[] = [];
    const now = new Date();

    for (const todo of filteredTodos) {
      if (todo.completed === 1) {
        completed.push(todo);
      } else if (todo.due_date && new Date(todo.due_date) < now) {
        overdue.push(todo);
      } else {
        active.push(todo);
      }
    }

    return { overdue, active, completed };
  }, [filteredTodos]);

  const createTodo = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);

    const payload = {
      title,
      description: description || null,
      priority,
      due_date: dueDate ? new Date(dueDate).toISOString() : null,
      recurrence_pattern: recurrence || null,
      reminder_minutes: reminderMinutes ? Number(reminderMinutes) : null,
      tag_ids: selectedTags
    };

    const response = await fetch('/api/todos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const data = await response.json();
      setError(data.error ?? 'Failed to create todo');
      return;
    }

    setTitle('');
    setDescription('');
    setPriority('medium');
    setDueDate('');
    setRecurrence('');
    setReminderMinutes('');
    setSelectedTags([]);

    await loadAll();
  };

  const updateTodo = async (todo: Todo, patch: Partial<Todo>) => {
    await fetch(`/api/todos/${todo.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...todo, ...patch, tag_ids: todo.tags.map((tag) => tag.id) })
    });
    await loadAll();
  };

  const deleteTodo = async (id: number) => {
    await fetch(`/api/todos/${id}`, { method: 'DELETE' });
    await loadAll();
  };

  const addSubtask = async (todoId: number) => {
    const titleValue = window.prompt('Subtask title');
    if (!titleValue) return;

    await fetch(`/api/todos/${todoId}/subtasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: titleValue })
    });
    await loadAll();
  };

  const toggleSubtask = async (subtask: Subtask) => {
    await fetch(`/api/subtasks/${subtask.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ completed: subtask.completed !== 1 })
    });
    await loadAll();
  };

  const createTag = async (event: FormEvent) => {
    event.preventDefault();
    await fetch('/api/tags', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newTagName, color: newTagColor })
    });
    setNewTagName('');
    await loadAll();
  };

  const saveTemplate = async () => {
    if (!newTemplateName.trim()) return;
    await fetch('/api/templates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: newTemplateName,
        title,
        description,
        priority,
        reminder_minutes: reminderMinutes ? Number(reminderMinutes) : null,
        recurrence_pattern: recurrence || null,
        tags: selectedTags,
        subtasks: []
      })
    });
    setNewTemplateName('');
    await loadAll();
  };

  const useTemplate = async (event: ChangeEvent<HTMLSelectElement>) => {
    const value = event.target.value;
    if (!value) return;
    await fetch(`/api/templates/${value}/use`, { method: 'POST' });
    event.target.value = '';
    await loadAll();
  };

  const exportData = async () => {
    const response = await fetch('/api/todos/export');
    const data = await response.json();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `todos_export_${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const importData = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const data = JSON.parse(await file.text());
    await fetch('/api/todos/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data })
    });
    event.target.value = '';
    await loadAll();
  };

  const logout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/login';
  };

  return (
    <main className="mx-auto max-w-6xl p-6">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-3xl font-bold">Todo Workspace</h1>
        <div className="flex gap-2">
          <Link href="/calendar" className="rounded bg-slate-200 px-3 py-2 text-sm">Calendar</Link>
          <button onClick={exportData} className="rounded bg-slate-200 px-3 py-2 text-sm">Export</button>
          <label className="rounded bg-slate-200 px-3 py-2 text-sm cursor-pointer">
            Import
            <input type="file" accept="application/json" onChange={importData} className="hidden" />
          </label>
          <button onClick={logout} className="rounded bg-rose-100 px-3 py-2 text-sm text-rose-700">Logout</button>
        </div>
      </header>

      <section className="mb-6 rounded-xl bg-white p-4 shadow">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-xl font-semibold">Create Todo</h2>
          <button
            onClick={requestPermission}
            className="rounded bg-cyan-100 px-3 py-1 text-xs font-medium text-cyan-700"
          >
            Notifications: {permission}
          </button>
        </div>

        <form onSubmit={createTodo} className="grid gap-2 md:grid-cols-2">
          <input className="rounded border px-3 py-2" placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} required />
          <input className="rounded border px-3 py-2" placeholder="Description" value={description} onChange={(e) => setDescription(e.target.value)} />
          <select className="rounded border px-3 py-2" value={priority} onChange={(e) => setPriority(e.target.value as Priority)}>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
          <input type="datetime-local" className="rounded border px-3 py-2" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          <select className="rounded border px-3 py-2" value={recurrence} onChange={(e) => setRecurrence(e.target.value as RecurrencePattern | '')}>
            <option value="">No recurrence</option>
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
            <option value="yearly">Yearly</option>
          </select>
          <select className="rounded border px-3 py-2" value={reminderMinutes} onChange={(e) => setReminderMinutes(e.target.value)}>
            {reminderOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>

          <div className="md:col-span-2">
            <p className="mb-1 text-sm font-medium">Tags</p>
            <div className="flex flex-wrap gap-2">
              {tags.map((tag) => {
                const selected = selectedTags.includes(tag.id);
                return (
                  <button
                    type="button"
                    key={tag.id}
                    onClick={() => setSelectedTags((prev) => selected ? prev.filter((id) => id !== tag.id) : [...prev, tag.id])}
                    className={`rounded px-2 py-1 text-xs font-medium ${selected ? 'ring-2 ring-slate-900' : ''}`}
                    style={{ backgroundColor: tag.color, color: '#fff' }}
                  >
                    {tag.name}
                  </button>
                );
              })}
            </div>
          </div>

          <button className="rounded bg-slate-900 px-4 py-2 text-white md:col-span-2" type="submit">Add Todo</button>
        </form>

        <div className="mt-3 flex gap-2">
          <input
            className="rounded border px-3 py-2"
            placeholder="Template name"
            value={newTemplateName}
            onChange={(e) => setNewTemplateName(e.target.value)}
          />
          <button className="rounded bg-emerald-600 px-3 py-2 text-white" onClick={saveTemplate}>Save as Template</button>
          <select onChange={useTemplate} defaultValue="" className="rounded border px-3 py-2">
            <option value="">Use template...</option>
            {templates.map((template) => (
              <option key={template.id} value={template.id}>{template.name}</option>
            ))}
          </select>
        </div>

        {error && <p className="mt-3 rounded bg-rose-50 p-2 text-sm text-rose-700">{error}</p>}
      </section>

      <section className="mb-6 rounded-xl bg-white p-4 shadow">
        <h2 className="mb-2 text-xl font-semibold">Manage Tags</h2>
        <form onSubmit={createTag} className="flex flex-wrap gap-2">
          <input className="rounded border px-3 py-2" placeholder="Tag name" value={newTagName} onChange={(e) => setNewTagName(e.target.value)} required />
          <input type="color" value={newTagColor} onChange={(e) => setNewTagColor(e.target.value)} className="h-10 w-14 rounded border" />
          <button className="rounded bg-slate-900 px-4 py-2 text-white" type="submit">Create tag</button>
        </form>
      </section>

      <section className="mb-6 rounded-xl bg-white p-4 shadow">
        <h2 className="mb-2 text-xl font-semibold">Search & Filters</h2>
        <div className="grid gap-2 md:grid-cols-4">
          <input className="rounded border px-3 py-2" placeholder="Search todos or subtasks" value={search} onChange={(e) => setSearch(e.target.value)} />
          <select className="rounded border px-3 py-2" value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
            <option value="all">All status</option>
            <option value="incomplete">Incomplete</option>
            <option value="complete">Completed</option>
          </select>
          <select className="rounded border px-3 py-2" value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value as typeof priorityFilter)}>
            <option value="all">All priorities</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
          <select
            className="rounded border px-3 py-2"
            value={tagFilter ?? ''}
            onChange={(e) => setTagFilter(e.target.value ? Number(e.target.value) : null)}
          >
            <option value="">All tags</option>
            {tags.map((tag) => <option key={tag.id} value={tag.id}>{tag.name}</option>)}
          </select>
        </div>
      </section>

      {([
        ['Overdue', grouped.overdue],
        ['Active', grouped.active],
        ['Completed', grouped.completed]
      ] as const).map(([label, list]) => (
        <section key={label} className="mb-6 rounded-xl bg-white p-4 shadow">
          <h2 className="mb-3 text-xl font-semibold">{label} ({list.length})</h2>
          <div className="space-y-3">
            {list.map((todo) => {
              const stat = progress(todo);
              return (
                <article key={todo.id} className="rounded border p-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <h3 className={`text-lg font-medium ${todo.completed ? 'line-through text-slate-400' : ''}`}>{todo.title}</h3>
                      {todo.description && <p className="text-sm text-slate-600">{todo.description}</p>}
                      <div className="mt-2 flex flex-wrap gap-2 text-xs">
                        <span className="rounded bg-slate-100 px-2 py-1">{todo.priority}</span>
                        {todo.due_date && <span className="rounded bg-slate-100 px-2 py-1">{new Date(todo.due_date).toLocaleString()}</span>}
                        {todo.recurrence_pattern && <span className="rounded bg-blue-100 px-2 py-1 text-blue-700">repeat: {todo.recurrence_pattern}</span>}
                        {todo.reminder_minutes !== null && <span className="rounded bg-cyan-100 px-2 py-1 text-cyan-700">reminder: {todo.reminder_minutes}m</span>}
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {todo.tags.map((tag) => <span key={tag.id} className="rounded px-2 py-1 text-xs text-white" style={{ backgroundColor: tag.color }}>{tag.name}</span>)}
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <button className="rounded bg-emerald-100 px-3 py-2 text-xs" onClick={() => updateTodo(todo, { completed: todo.completed === 1 ? 0 : 1 })}>
                        {todo.completed ? 'Mark Active' : 'Complete'}
                      </button>
                      <button className="rounded bg-amber-100 px-3 py-2 text-xs" onClick={() => addSubtask(todo.id)}>Add Subtask</button>
                      <button className="rounded bg-rose-100 px-3 py-2 text-xs text-rose-700" onClick={() => deleteTodo(todo.id)}>Delete</button>
                    </div>
                  </div>

                  <div className="mt-3">
                    <p className="mb-1 text-xs text-slate-500">Subtasks: {stat.completed}/{stat.total} ({stat.percent}%)</p>
                    <div className="h-2 rounded bg-slate-200">
                      <div className={`h-2 rounded ${stat.percent === 100 ? 'bg-emerald-500' : 'bg-sky-500'}`} style={{ width: `${stat.percent}%` }} />
                    </div>
                    <ul className="mt-2 space-y-1">
                      {todo.subtasks.map((subtask) => (
                        <li key={subtask.id} className="flex items-center gap-2 text-sm">
                          <input type="checkbox" checked={subtask.completed === 1} onChange={() => toggleSubtask(subtask)} />
                          <span className={subtask.completed ? 'line-through text-slate-400' : ''}>{subtask.title}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </article>
              );
            })}
            {list.length === 0 && <p className="text-sm text-slate-500">No todos in this section.</p>}
          </div>
        </section>
      ))}
    </main>
  );
}
