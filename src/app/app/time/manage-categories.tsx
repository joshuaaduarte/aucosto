"use client";

// "Manage categories" bottom sheet for the time tracker. Lets Josh rename,
// recolor, hide/show, and reorder his life categories, and add new ones — all
// without leaving the start flow. Persists through the server actions in
// ./actions; the DB is the source of truth (see services/time-categories).

import { useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { useBodyScrollLock } from "../_components/use-body-scroll-lock";
import {
  createCategoryAction,
  reorderCategoriesAction,
  updateCategoryAction,
} from "./actions";

export type ManageableCategory = {
  id: string;
  name: string;
  color: string;
  emoji: string | null;
  isHidden: boolean;
};

export function ManageCategories({
  categories,
}: {
  categories: ManageableCategory[];
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[0.6875rem] font-medium transition-colors"
        style={{ color: "var(--text-faint)" }}
        title="Manage categories"
      >
        <svg
          width="12"
          height="12"
          viewBox="0 0 14 14"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <circle cx="7" cy="7" r="2" />
          <path d="M7 1v2M7 11v2M1 7h2M11 7h2M2.8 2.8l1.4 1.4M9.8 9.8l1.4 1.4M11.2 2.8l-1.4 1.4M4.2 9.8l-1.4 1.4" />
        </svg>
        Manage
      </button>
      {open ? (
        <ManageSheet
          categories={categories}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}

function ManageSheet({
  categories,
  onClose,
}: {
  categories: ManageableCategory[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  useBodyScrollLock();

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) => {
    startTransition(async () => {
      setError(null);
      const result = await fn();
      if (!result.ok) {
        setError(result.error ?? "Something went wrong.");
        return;
      }
      router.refresh();
    });
  };

  const move = (index: number, direction: -1 | 1) => {
    const next = index + direction;
    if (next < 0 || next >= categories.length) return;
    const order = categories.map((category) => category.id);
    const moved = order[index]!;
    order[index] = order[next]!;
    order[next] = moved;
    run(() => reorderCategoriesAction(order));
  };

  const toggleHidden = (category: ManageableCategory) => {
    const formData = new FormData();
    formData.set("id", category.id);
    formData.set("isHidden", category.isHidden ? "false" : "true");
    run(() => updateCategoryAction(formData));
  };

  const recolor = (category: ManageableCategory, color: string) => {
    const formData = new FormData();
    formData.set("id", category.id);
    formData.set("color", color);
    run(() => updateCategoryAction(formData));
  };

  return createPortal(
    <div className="calendar-modal-backdrop" role="presentation" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="manage-categories-title"
        className="calendar-modal"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p
              className="text-[0.6875rem] font-semibold uppercase tracking-wider"
              style={{ color: "var(--text-faint)" }}
            >
              Time
            </p>
            <h2
              id="manage-categories-title"
              className="mt-1 text-[1.125rem] font-semibold tracking-tight"
              style={{ color: "var(--text)" }}
            >
              Manage categories
            </h2>
          </div>
          <button
            type="button"
            className="btn-icon h-8 w-8 rounded-full border"
            style={{ borderColor: "var(--border-faint)" }}
            onClick={onClose}
            aria-label="Close manage categories"
          >
            ×
          </button>
        </div>

        {error ? (
          <p
            className="mt-4 rounded-md px-3 py-2 text-[0.8125rem]"
            style={{
              background: "var(--accent-tint)",
              color: "var(--accent-strong)",
              border: "1px solid var(--accent-tint-strong)",
            }}
          >
            {error}
          </p>
        ) : null}

        <ul className="mt-5 space-y-1.5">
          {categories.map((category, index) => (
            <li
              key={category.id}
              className="flex items-center gap-2 rounded-md px-2 py-1.5"
              style={{
                border: "1px solid var(--border-faint)",
                opacity: category.isHidden ? 0.55 : 1,
              }}
            >
              <div className="flex flex-col">
                <button
                  type="button"
                  onClick={() => move(index, -1)}
                  disabled={pending || index === 0}
                  aria-label="Move up"
                  className="btn-icon h-4 leading-none disabled:opacity-30"
                  style={{ color: "var(--text-faint)" }}
                >
                  ▲
                </button>
                <button
                  type="button"
                  onClick={() => move(index, 1)}
                  disabled={pending || index === categories.length - 1}
                  aria-label="Move down"
                  className="btn-icon h-4 leading-none disabled:opacity-30"
                  style={{ color: "var(--text-faint)" }}
                >
                  ▼
                </button>
              </div>

              <label
                className="relative h-5 w-5 shrink-0 cursor-pointer rounded-full"
                style={{ background: category.color }}
                title="Change color"
              >
                <input
                  type="color"
                  defaultValue={category.color}
                  onChange={(event) => recolor(category, event.target.value)}
                  className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                  aria-label={`Color for ${category.name}`}
                />
              </label>

              <span
                className="min-w-0 flex-1 truncate text-[0.8125rem] font-medium"
                style={{ color: "var(--text)" }}
              >
                {category.emoji ? `${category.emoji} ` : ""}
                {category.name}
              </span>

              <button
                type="button"
                onClick={() => toggleHidden(category)}
                disabled={pending}
                className="btn-ghost h-7 shrink-0 px-2 text-[0.6875rem]"
              >
                {category.isHidden ? "Show" : "Hide"}
              </button>
            </li>
          ))}
        </ul>

        <NewCategoryRow
          pending={pending}
          onCreate={(formData) => run(() => createCategoryAction(formData))}
        />

        <div
          className="sticky bottom-0 -mx-4 mt-5 flex items-center justify-end gap-3 border-t px-4 pb-1 pt-3 sm:-mx-5 sm:px-5"
          style={{
            background: "var(--bg-page)",
            borderColor: "var(--border-faint)",
          }}
        >
          <button type="button" className="btn-ink" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function NewCategoryRow({
  pending,
  onCreate,
}: {
  pending: boolean;
  onCreate: (formData: FormData) => void;
}) {
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState("");
  const [color, setColor] = useState("#6366f1");

  const submit = () => {
    if (!name.trim()) return;
    const formData = new FormData();
    formData.set("name", name.trim());
    formData.set("color", color);
    if (emoji.trim()) formData.set("emoji", emoji.trim());
    onCreate(formData);
    setName("");
    setEmoji("");
  };

  return (
    <div
      className="mt-4 rounded-md p-3"
      style={{ background: "var(--bg-tint)" }}
    >
      <p
        className="mb-2 text-[0.6875rem] font-semibold uppercase tracking-wider"
        style={{ color: "var(--text-faint)" }}
      >
        New category
      </p>
      <div className="flex items-center gap-2">
        <label
          className="relative h-8 w-8 shrink-0 cursor-pointer rounded-full"
          style={{ background: color }}
          title="Pick a color"
        >
          <input
            type="color"
            value={color}
            onChange={(event) => setColor(event.target.value)}
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
            aria-label="New category color"
          />
        </label>
        <input
          type="text"
          value={emoji}
          onChange={(event) => setEmoji(event.target.value.slice(0, 8))}
          placeholder="😀"
          aria-label="New category emoji"
          className="field w-12 shrink-0 text-center"
        />
        <input
          type="text"
          value={name}
          onChange={(event) => setName(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              submit();
            }
          }}
          placeholder="Category name"
          aria-label="New category name"
          className="field min-w-0 flex-1"
          maxLength={40}
        />
        <button
          type="button"
          onClick={submit}
          disabled={pending || !name.trim()}
          className="btn-ink shrink-0"
        >
          Add
        </button>
      </div>
    </div>
  );
}
