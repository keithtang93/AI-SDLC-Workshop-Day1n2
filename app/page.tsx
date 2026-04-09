"use client";

import Link from "next/link";
import {
  ChangeEvent,
  FormEvent,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useNotifications } from "@/lib/hooks/useNotifications";

type Priority = "high" | "medium" | "low";
type RecurrencePattern = "daily" | "weekly" | "monthly" | "yearly";

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
  description: string | null;
  category: string | null;
  title: string;
  priority: Priority;
  reminder_minutes: number | null;
  recurrence_pattern: RecurrencePattern | null;
  tags_json: string;
  subtasks_json: string;
}

const reminderOptions = [
  { label: "None", value: "" },
  { label: "15 minutes before", value: "15" },
  { label: "30 minutes before", value: "30" },
  { label: "1 hour before", value: "60" },
  { label: "2 hours before", value: "120" },
  { label: "1 day before", value: "1440" },
  { label: "2 days before", value: "2880" },
  { label: "1 week before", value: "10080" },
];

const priorityColors: Record<Priority, string> = {
  high: "bg-red-100 text-red-700",
  medium: "bg-yellow-100 text-yellow-700",
  low: "bg-blue-100 text-blue-700",
};

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);

  return debouncedValue;
}

function progress(todo: Todo): {
  completed: number;
  total: number;
  percent: number;
} {
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

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<Priority>("medium");
  const [dueDate, setDueDate] = useState("");
  const [recurrence, setRecurrence] = useState<RecurrencePattern | "">("");
  const [reminderMinutes, setReminderMinutes] = useState("");
  const [selectedTags, setSelectedTags] = useState<number[]>([]);

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"all" | "incomplete" | "complete">(
    "all",
  );
  const [priorityFilter, setPriorityFilter] = useState<"all" | Priority>("all");
  const [tagFilter, setTagFilter] = useState<number | null>(null);

  const [newTagName, setNewTagName] = useState("");
  const [newTagColor, setNewTagColor] = useState("#3B82F6");
  const [editingTag, setEditingTag] = useState<Tag | null>(null);
  const [editTagName, setEditTagName] = useState("");
  const [editTagColor, setEditTagColor] = useState("#3B82F6");

  const [newTemplateName, setNewTemplateName] = useState("");
  const [newTemplateDescription, setNewTemplateDescription] = useState("");
  const [newTemplateCategory, setNewTemplateCategory] = useState("");

  const [editingTodo, setEditingTodo] = useState<Todo | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editPriority, setEditPriority] = useState<Priority>("medium");
  const [editDueDate, setEditDueDate] = useState("");
  const [editRecurrence, setEditRecurrence] = useState<
    RecurrencePattern | ""
  >("");
  const [editReminderMinutes, setEditReminderMinutes] = useState("");
  const [editSelectedTags, setEditSelectedTags] = useState<number[]>([]);

  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const [previewTemplate, setPreviewTemplate] = useState<Template | null>(null);
  const [importMessage, setImportMessage] = useState<string | null>(null);

  const { permission, requestPermission } = useNotifications();

  const debouncedSearch = useDebounce(search, 300);

  const loadAll = async () => {
    const [todoRes, tagRes, templateRes] = await Promise.all([
      fetch("/api/todos"),
      fetch("/api/tags"),
      fetch("/api/templates"),
    ]);

    if (!todoRes.ok) {
      setError("Unable to load todos. Try logging in again.");
      return;
    }

    const todoData = await todoRes.json();
    const tagData = tagRes.ok ? await tagRes.json() : { tags: [] };
    const templateData = templateRes.ok
      ? await templateRes.json()
      : { templates: [] };

    setTodos(todoData.todos ?? []);
    setTags(tagData.tags ?? []);
    setTemplates(templateData.templates ?? []);
  };

  useEffect(() => {
    loadAll();
  }, []);

  const filteredTodos = useMemo(() => {
    const query = debouncedSearch.toLowerCase();
    return todos.filter((todo) => {
      if (status === "complete" && todo.completed !== 1) return false;
      if (status === "incomplete" && todo.completed === 1) return false;
      if (priorityFilter !== "all" && todo.priority !== priorityFilter)
        return false;
      if (tagFilter && !todo.tags.some((tag) => tag.id === tagFilter))
        return false;

      if (!query) return true;
      const titleMatch = todo.title.toLowerCase().includes(query);
      const subtaskMatch = todo.subtasks.some((subtask) =>
        subtask.title.toLowerCase().includes(query),
      );
      const tagMatch = todo.tags.some((tag) =>
        tag.name.toLowerCase().includes(query),
      );
      return titleMatch || subtaskMatch || tagMatch;
    });
  }, [todos, debouncedSearch, status, priorityFilter, tagFilter]);

  const hasActiveFilters =
    debouncedSearch !== "" ||
    status !== "all" ||
    priorityFilter !== "all" ||
    tagFilter !== null;

  const clearAllFilters = () => {
    setSearch("");
    setStatus("all");
    setPriorityFilter("all");
    setTagFilter(null);
  };

  const grouped = useMemo(() => {
    const priorityOrder: Record<Priority, number> = { high: 0, medium: 1, low: 2 };
    const sortByPriority = (a: Todo, b: Todo) => priorityOrder[a.priority] - priorityOrder[b.priority];

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

    overdue.sort(sortByPriority);
    active.sort(sortByPriority);
    completed.sort(sortByPriority);

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
      tag_ids: selectedTags,
    };

    const response = await fetch("/api/todos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const data = await response.json();
      setError(data.error ?? "Failed to create todo");
      return;
    }

    setTitle("");
    setDescription("");
    setPriority("medium");
    setDueDate("");
    setRecurrence("");
    setReminderMinutes("");
    setSelectedTags([]);

    await loadAll();
  };

  const updateTodo = async (todo: Todo, patch: Partial<Todo>) => {
    await fetch(`/api/todos/${todo.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...todo,
        ...patch,
        tag_ids: todo.tags.map((tag) => tag.id),
      }),
    });
    await loadAll();
  };

  const deleteTodo = async (id: number) => {
    await fetch(`/api/todos/${id}`, { method: "DELETE" });
    setDeleteConfirmId(null);
    await loadAll();
  };

  const openEditModal = (todo: Todo) => {
    setEditingTodo(todo);
    setEditTitle(todo.title);
    setEditDescription(todo.description ?? "");
    setEditPriority(todo.priority);
    setEditDueDate(
      todo.due_date
        ? new Date(todo.due_date).toISOString().slice(0, 16)
        : "",
    );
    setEditRecurrence(todo.recurrence_pattern ?? "");
    setEditReminderMinutes(
      todo.reminder_minutes !== null ? String(todo.reminder_minutes) : "",
    );
    setEditSelectedTags(todo.tags.map((tag) => tag.id));
  };

  const saveEdit = async (event: FormEvent) => {
    event.preventDefault();
    if (!editingTodo) return;

    await fetch(`/api/todos/${editingTodo.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: editTitle,
        description: editDescription || null,
        priority: editPriority,
        due_date: editDueDate ? new Date(editDueDate).toISOString() : null,
        recurrence_pattern: editRecurrence || null,
        reminder_minutes: editReminderMinutes
          ? Number(editReminderMinutes)
          : null,
        tag_ids: editSelectedTags,
      }),
    });
    setEditingTodo(null);
    await loadAll();
  };

  const addSubtask = async (todoId: number) => {
    const titleValue = window.prompt("Subtask title");
    if (!titleValue) return;

    await fetch(`/api/todos/${todoId}/subtasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: titleValue }),
    });
    await loadAll();
  };

  const toggleSubtask = async (subtask: Subtask) => {
    await fetch(`/api/subtasks/${subtask.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ completed: subtask.completed !== 1 }),
    });
    await loadAll();
  };

  const deleteSubtask = async (subtaskId: number) => {
    await fetch(`/api/subtasks/${subtaskId}`, { method: "DELETE" });
    await loadAll();
  };

  const createTag = async (event: FormEvent) => {
    event.preventDefault();
    await fetch("/api/tags", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newTagName, color: newTagColor }),
    });
    setNewTagName("");
    await loadAll();
  };

  const startEditTag = (tag: Tag) => {
    setEditingTag(tag);
    setEditTagName(tag.name);
    setEditTagColor(tag.color);
  };

  const saveTag = async (event: FormEvent) => {
    event.preventDefault();
    if (!editingTag) return;
    await fetch(`/api/tags/${editingTag.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: editTagName, color: editTagColor }),
    });
    setEditingTag(null);
    await loadAll();
  };

  const deleteTag = async (tagId: number) => {
    await fetch(`/api/tags/${tagId}`, { method: "DELETE" });
    if (tagFilter === tagId) setTagFilter(null);
    await loadAll();
  };

  const saveTemplate = async () => {
    if (!newTemplateName.trim()) return;
    await fetch("/api/templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: newTemplateName,
        description: newTemplateDescription || null,
        category: newTemplateCategory || null,
        title,
        priority,
        reminder_minutes: reminderMinutes ? Number(reminderMinutes) : null,
        recurrence_pattern: recurrence || null,
        tags: selectedTags,
        subtasks: [],
      }),
    });
    setNewTemplateName("");
    setNewTemplateDescription("");
    setNewTemplateCategory("");
    await loadAll();
  };

  const useTemplate = async (event: ChangeEvent<HTMLSelectElement>) => {
    const value = event.target.value;
    if (!value) return;
    await fetch(`/api/templates/${value}/use`, { method: "POST" });
    event.target.value = "";
    await loadAll();
  };

  const exportData = async () => {
    const response = await fetch("/api/todos/export");
    const data = await response.json();
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `todos_export_${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const importData = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const data = JSON.parse(await file.text());
    const response = await fetch("/api/todos/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data }),
    });
    const result = await response.json();
    if (response.ok && result.imported !== undefined) {
      setImportMessage(`Successfully imported ${result.imported} todo${result.imported === 1 ? "" : "s"}`);
      setTimeout(() => setImportMessage(null), 5000);
    }
    event.target.value = "";
    await loadAll();
  };

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  };

  return (
    <main className="mx-auto max-w-6xl p-6">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-3xl font-bold">Todo Workspace</h1>
        <div className="flex gap-2">
          <Link
            href="/calendar"
            className="rounded bg-slate-200 px-3 py-2 text-sm"
          >
            Calendar
          </Link>
          <button
            onClick={exportData}
            className="rounded bg-slate-200 px-3 py-2 text-sm"
          >
            Export
          </button>
          <label className="rounded bg-slate-200 px-3 py-2 text-sm cursor-pointer">
            Import
            <input
              type="file"
              accept="application/json"
              onChange={importData}
              className="hidden"
            />
          </label>
          <button
            onClick={logout}
            className="rounded bg-rose-100 px-3 py-2 text-sm text-rose-700"
          >
            Logout
          </button>
        </div>
      </header>

      {importMessage && (
        <div className="mb-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700" data-testid="import-success">
          {importMessage}
        </div>
      )}

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
          <input
            className="rounded border px-3 py-2"
            placeholder="Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />
          <input
            className="rounded border px-3 py-2"
            placeholder="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          <select
            className="rounded border px-3 py-2"
            value={priority}
            onChange={(e) => setPriority(e.target.value as Priority)}
          >
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
          <input
            type="datetime-local"
            className="rounded border px-3 py-2"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
          />
          <select
            className="rounded border px-3 py-2"
            value={recurrence}
            onChange={(e) =>
              setRecurrence(e.target.value as RecurrencePattern | "")
            }
          >
            <option value="">No recurrence</option>
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
            <option value="yearly">Yearly</option>
          </select>
          <select
            className="rounded border px-3 py-2 disabled:opacity-50 disabled:cursor-not-allowed"
            value={reminderMinutes}
            onChange={(e) => setReminderMinutes(e.target.value)}
            disabled={!dueDate}
            title={!dueDate ? "Set a due date first to enable reminders" : ""}
          >
            {reminderOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
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
                    onClick={() =>
                      setSelectedTags((prev) =>
                        selected
                          ? prev.filter((id) => id !== tag.id)
                          : [...prev, tag.id],
                      )
                    }
                    className={`rounded px-2 py-1 text-xs font-medium ${selected ? "ring-2 ring-slate-900" : ""}`}
                    style={{ backgroundColor: tag.color, color: "#fff" }}
                  >
                    {tag.name}
                  </button>
                );
              })}
            </div>
          </div>

          <button
            className="rounded bg-slate-900 px-4 py-2 text-white md:col-span-2"
            type="submit"
          >
            Add Todo
          </button>
        </form>

        <div className="mt-3 flex flex-wrap gap-2">
          <input
            className="rounded border px-3 py-2"
            placeholder="Template name"
            value={newTemplateName}
            onChange={(e) => setNewTemplateName(e.target.value)}
          />
          <input
            className="rounded border px-3 py-2"
            placeholder="Template notes"
            value={newTemplateDescription}
            onChange={(e) => setNewTemplateDescription(e.target.value)}
          />
          <input
            className="rounded border px-3 py-2"
            placeholder="Category (optional)"
            value={newTemplateCategory}
            onChange={(e) => setNewTemplateCategory(e.target.value)}
          />
          <button
            className="rounded bg-emerald-600 px-3 py-2 text-white"
            onClick={saveTemplate}
          >
            Save as Template
          </button>
          <select
            onChange={useTemplate}
            defaultValue=""
            className="rounded border px-3 py-2"
          >
            <option value="">Use template...</option>
            {templates.map((template) => (
              <option key={template.id} value={template.id}>
                {template.name}
                {template.category ? ` [${template.category}]` : ""}
              </option>
            ))}
          </select>
          {templates.length > 0 && (
            <select
              onChange={(e) => {
                const id = Number(e.target.value);
                setPreviewTemplate(id ? templates.find((t) => t.id === id) ?? null : null);
              }}
              defaultValue=""
              className="rounded border px-3 py-2"
            >
              <option value="">Preview template...</option>
              {templates.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.name}
                </option>
              ))}
            </select>
          )}
        </div>

        {previewTemplate && (
          <div className="mt-3 rounded border border-slate-200 bg-slate-50 p-3" data-testid="template-preview">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-semibold">Template Preview: {previewTemplate.name}</h3>
              <button
                onClick={() => setPreviewTemplate(null)}
                className="rounded bg-slate-200 px-2 py-1 text-xs"
              >
                Close
              </button>
            </div>
            <div className="grid gap-1 text-xs text-slate-600">
              <p><span className="font-medium">Title:</span> {previewTemplate.title}</p>
              <p><span className="font-medium">Priority:</span> {previewTemplate.priority}</p>
              {previewTemplate.description && (
                <p><span className="font-medium">Description:</span> {previewTemplate.description}</p>
              )}
              {previewTemplate.recurrence_pattern && (
                <p><span className="font-medium">Recurrence:</span> {previewTemplate.recurrence_pattern}</p>
              )}
              {previewTemplate.reminder_minutes !== null && (
                <p><span className="font-medium">Reminder:</span> {previewTemplate.reminder_minutes} minutes before</p>
              )}
              {(() => {
                const subtasks = JSON.parse(previewTemplate.subtasks_json || "[]") as Array<{title: string}>;
                return subtasks.length > 0 ? (
                  <div>
                    <span className="font-medium">Subtasks:</span>
                    <ul className="ml-4 list-disc">
                      {subtasks.map((s, i) => <li key={i}>{s.title}</li>)}
                    </ul>
                  </div>
                ) : null;
              })()}
            </div>
          </div>
        )}

        {error && (
          <p className="mt-3 rounded bg-rose-50 p-2 text-sm text-rose-700">
            {error}
          </p>
        )}
      </section>

      <section className="mb-6 rounded-xl bg-white p-4 shadow">
        <h2 className="mb-2 text-xl font-semibold">Manage Tags</h2>
        <form onSubmit={createTag} className="flex flex-wrap gap-2">
          <input
            className="rounded border px-3 py-2"
            placeholder="Tag name"
            value={newTagName}
            onChange={(e) => setNewTagName(e.target.value)}
            required
          />
          <input
            type="color"
            value={newTagColor}
            onChange={(e) => setNewTagColor(e.target.value)}
            className="h-10 w-14 rounded border"
          />
          <button
            className="rounded bg-slate-900 px-4 py-2 text-white"
            type="submit"
          >
            Create tag
          </button>
        </form>
        {tags.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {tags.map((tag) => (
              <div
                key={tag.id}
                className="flex items-center gap-1 rounded px-2 py-1 text-xs text-white"
                style={{ backgroundColor: tag.color }}
              >
                <span>{tag.name}</span>
                <button
                  onClick={() => startEditTag(tag)}
                  className="ml-1 rounded bg-white/30 px-1 hover:bg-white/50"
                  title="Edit tag"
                >
                  ✏️
                </button>
                <button
                  onClick={() => deleteTag(tag.id)}
                  className="rounded bg-white/30 px-1 hover:bg-white/50"
                  title="Delete tag"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
        {editingTag && (
          <form onSubmit={saveTag} className="mt-3 flex flex-wrap gap-2 rounded border p-2">
            <span className="text-sm font-medium self-center">Edit tag:</span>
            <input
              className="rounded border px-3 py-2"
              placeholder="Tag name"
              value={editTagName}
              onChange={(e) => setEditTagName(e.target.value)}
              required
            />
            <input
              type="color"
              value={editTagColor}
              onChange={(e) => setEditTagColor(e.target.value)}
              className="h-10 w-14 rounded border"
            />
            <button
              className="rounded bg-slate-900 px-4 py-2 text-white"
              type="submit"
            >
              Save
            </button>
            <button
              type="button"
              className="rounded bg-slate-200 px-4 py-2"
              onClick={() => setEditingTag(null)}
            >
              Cancel
            </button>
          </form>
        )}
      </section>

      <section className="mb-6 rounded-xl bg-white p-4 shadow">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-xl font-semibold">Search & Filters</h2>
          {hasActiveFilters && (
            <button
              onClick={clearAllFilters}
              className="rounded bg-rose-100 px-3 py-1 text-xs font-medium text-rose-700"
            >
              Clear All Filters
            </button>
          )}
        </div>
        {hasActiveFilters && (
          <div className="mb-2 flex flex-wrap gap-2 text-xs">
            {debouncedSearch && (
              <span className="rounded bg-slate-100 px-2 py-1">
                Search: &quot;{debouncedSearch}&quot;
              </span>
            )}
            {status !== "all" && (
              <span className="rounded bg-slate-100 px-2 py-1">
                Status: {status}
              </span>
            )}
            {priorityFilter !== "all" && (
              <span className="rounded bg-slate-100 px-2 py-1">
                Priority: {priorityFilter}
              </span>
            )}
            {tagFilter && (
              <span className="rounded bg-slate-100 px-2 py-1">
                Tag: {tags.find((t) => t.id === tagFilter)?.name}
              </span>
            )}
          </div>
        )}
        <div className="grid gap-2 md:grid-cols-4">
          <input
            className="rounded border px-3 py-2"
            placeholder="Search todos, subtasks, or tags"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select
            className="rounded border px-3 py-2"
            value={status}
            onChange={(e) => setStatus(e.target.value as typeof status)}
          >
            <option value="all">All status</option>
            <option value="incomplete">Incomplete</option>
            <option value="complete">Completed</option>
          </select>
          <select
            className="rounded border px-3 py-2"
            value={priorityFilter}
            onChange={(e) =>
              setPriorityFilter(e.target.value as typeof priorityFilter)
            }
          >
            <option value="all">All priorities</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
          <select
            className="rounded border px-3 py-2"
            value={tagFilter ?? ""}
            onChange={(e) =>
              setTagFilter(e.target.value ? Number(e.target.value) : null)
            }
          >
            <option value="">All tags</option>
            {tags.map((tag) => (
              <option key={tag.id} value={tag.id}>
                {tag.name}
              </option>
            ))}
          </select>
        </div>
      </section>

      {(
        [
          ["Overdue", grouped.overdue],
          ["Active", grouped.active],
          ["Completed", grouped.completed],
        ] as const
      ).map(([label, list]) => (
        <section key={label} className="mb-6 rounded-xl bg-white p-4 shadow">
          <h2 className="mb-3 text-xl font-semibold">
            {label} ({list.length})
          </h2>
          <div className="space-y-3">
            {list.map((todo) => {
              const stat = progress(todo);
              return (
                <article key={todo.id} className="rounded border p-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <h3
                        className={`text-lg font-medium ${todo.completed ? "line-through text-slate-400" : ""}`}
                      >
                        {todo.title}
                      </h3>
                      {todo.description && (
                        <p className="text-sm text-slate-600">
                          {todo.description}
                        </p>
                      )}
                      <div className="mt-2 flex flex-wrap gap-2 text-xs">
                        <span
                          className={`rounded px-2 py-1 font-medium ${priorityColors[todo.priority]}`}
                        >
                          {todo.priority}
                        </span>
                        {todo.due_date && (
                          <span className="rounded bg-slate-100 px-2 py-1">
                            {new Date(todo.due_date).toLocaleString()}
                          </span>
                        )}
                        {todo.recurrence_pattern && (
                          <span className="rounded bg-blue-100 px-2 py-1 text-blue-700">
                            repeat: {todo.recurrence_pattern}
                          </span>
                        )}
                        {todo.reminder_minutes !== null && (
                          <span className="rounded bg-cyan-100 px-2 py-1 text-cyan-700">
                            reminder: {todo.reminder_minutes}m
                          </span>
                        )}
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {todo.tags.map((tag) => (
                          <button
                            key={tag.id}
                            onClick={() => setTagFilter(tag.id)}
                            className="rounded px-2 py-1 text-xs text-white cursor-pointer hover:opacity-80"
                            style={{ backgroundColor: tag.color }}
                            title={`Filter by tag: ${tag.name}`}
                          >
                            {tag.name}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <button
                        className="rounded bg-emerald-100 px-3 py-2 text-xs"
                        onClick={() =>
                          updateTodo(todo, {
                            completed: todo.completed === 1 ? 0 : 1,
                          })
                        }
                      >
                        {todo.completed ? "Mark Active" : "Complete"}
                      </button>
                      <button
                        className="rounded bg-slate-100 px-3 py-2 text-xs"
                        onClick={() => openEditModal(todo)}
                      >
                        Edit
                      </button>
                      <button
                        className="rounded bg-amber-100 px-3 py-2 text-xs"
                        onClick={() => addSubtask(todo.id)}
                      >
                        Add Subtask
                      </button>
                      {deleteConfirmId === todo.id ? (
                        <div className="flex gap-1">
                          <button
                            className="rounded bg-rose-600 px-3 py-2 text-xs text-white"
                            onClick={() => deleteTodo(todo.id)}
                          >
                            Confirm
                          </button>
                          <button
                            className="rounded bg-slate-200 px-3 py-2 text-xs"
                            onClick={() => setDeleteConfirmId(null)}
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          className="rounded bg-rose-100 px-3 py-2 text-xs text-rose-700"
                          onClick={() => setDeleteConfirmId(todo.id)}
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="mt-3">
                    <p className="mb-1 text-xs text-slate-500">
                      Subtasks: {stat.completed}/{stat.total} ({stat.percent}%)
                    </p>
                    <div className="h-2 rounded bg-slate-200">
                      <div
                        className={`h-2 rounded ${stat.percent === 100 ? "bg-emerald-500" : "bg-sky-500"}`}
                        style={{ width: `${stat.percent}%` }}
                      />
                    </div>
                    <ul className="mt-2 space-y-1">
                      {todo.subtasks.map((subtask) => (
                        <li
                          key={subtask.id}
                          className="flex items-center gap-2 text-sm"
                        >
                          <input
                            type="checkbox"
                            checked={subtask.completed === 1}
                            onChange={() => toggleSubtask(subtask)}
                          />
                          <span
                            className={`flex-1 ${
                              subtask.completed
                                ? "line-through text-slate-400"
                                : ""
                            }`}
                          >
                            {subtask.title}
                          </span>
                          <button
                            onClick={() => deleteSubtask(subtask.id)}
                            className="rounded bg-rose-50 px-2 py-0.5 text-xs text-rose-600 hover:bg-rose-100"
                            title="Delete subtask"
                          >
                            ✕
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                </article>
              );
            })}
            {list.length === 0 && (
              <p className="text-sm text-slate-500">
                No todos in this section.
              </p>
            )}
          </div>
        </section>
      ))}

      {/* Edit Todo Modal */}
      {editingTodo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="mx-4 w-full max-w-lg rounded-xl bg-white p-6 shadow-xl">
            <h2 className="mb-4 text-xl font-semibold">Edit Todo</h2>
            <form onSubmit={saveEdit} className="grid gap-3">
              <input
                className="rounded border px-3 py-2"
                placeholder="Title"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                required
              />
              <input
                className="rounded border px-3 py-2"
                placeholder="Description"
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
              />
              <select
                className="rounded border px-3 py-2"
                value={editPriority}
                onChange={(e) => setEditPriority(e.target.value as Priority)}
              >
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
              <input
                type="datetime-local"
                className="rounded border px-3 py-2"
                value={editDueDate}
                onChange={(e) => setEditDueDate(e.target.value)}
              />
              <select
                className="rounded border px-3 py-2"
                value={editRecurrence}
                onChange={(e) =>
                  setEditRecurrence(
                    e.target.value as RecurrencePattern | "",
                  )
                }
              >
                <option value="">No recurrence</option>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="yearly">Yearly</option>
              </select>
              <select
                className="rounded border px-3 py-2 disabled:opacity-50 disabled:cursor-not-allowed"
                value={editReminderMinutes}
                onChange={(e) => setEditReminderMinutes(e.target.value)}
                disabled={!editDueDate}
                title={!editDueDate ? "Set a due date first to enable reminders" : ""}
              >
                {reminderOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <div>
                <p className="mb-1 text-sm font-medium">Tags</p>
                <div className="flex flex-wrap gap-2">
                  {tags.map((tag) => {
                    const selected = editSelectedTags.includes(tag.id);
                    return (
                      <button
                        type="button"
                        key={tag.id}
                        onClick={() =>
                          setEditSelectedTags((prev) =>
                            selected
                              ? prev.filter((id) => id !== tag.id)
                              : [...prev, tag.id],
                          )
                        }
                        className={`rounded px-2 py-1 text-xs font-medium ${selected ? "ring-2 ring-slate-900" : ""}`}
                        style={{
                          backgroundColor: tag.color,
                          color: "#fff",
                        }}
                      >
                        {tag.name}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  className="rounded bg-slate-200 px-4 py-2"
                  onClick={() => setEditingTodo(null)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded bg-slate-900 px-4 py-2 text-white"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
