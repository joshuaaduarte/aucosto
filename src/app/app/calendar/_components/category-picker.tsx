"use client";

// Tappable row of TimeCategory pills for assigning a category to a calendar
// block. Mirrors the time tracker's preset-chip look (color dot + name, active
// state ringed in the category color). Controlled: the parent owns the selected
// id and renders a hidden `categoryId` input for the form submit.

export type PickableCategory = {
  id: string;
  name: string;
  color: string;
  emoji?: string | null;
};

export function CategoryPicker({
  categories,
  value,
  onChange,
}: {
  categories: PickableCategory[];
  /** Selected TimeCategory id, or "" for none. */
  value: string;
  onChange: (next: string) => void;
}) {
  if (categories.length === 0) return null;
  return (
    <div className="space-y-1.5">
      <p
        className="text-[0.75rem] font-medium"
        style={{ color: "var(--text-muted)" }}
      >
        Category <span style={{ color: "var(--text-faint)" }}>(optional)</span>
      </p>
      {/* One swipeable row on phones, wrapping on desktop — same affordance as
          the time tracker's category chips. */}
      <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 sm:flex-wrap sm:overflow-visible">
        {categories.map((category) => {
          const active = value === category.id;
          return (
            <button
              key={category.id}
              type="button"
              onClick={() => onChange(active ? "" : category.id)}
              className="inline-flex shrink-0 items-center gap-1.5 rounded px-2 py-1.5 text-[0.75rem] font-medium transition-colors"
              style={{
                background: active ? "var(--bg-tint-strong)" : "var(--bg-tint)",
                color: active ? "var(--text)" : "var(--text-muted)",
                boxShadow: active ? `inset 0 0 0 1px ${category.color}` : undefined,
              }}
            >
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{ background: category.color }}
                aria-hidden
              />
              {category.emoji ? `${category.emoji} ` : ""}
              {category.name}
            </button>
          );
        })}
      </div>
    </div>
  );
}
