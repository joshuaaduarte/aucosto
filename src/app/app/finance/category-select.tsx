"use client";

import { useTransition } from "react";
import { FINANCE_CATEGORIES, type FinanceCategory } from "@/lib/finance-categories";
import { updateTransactionCategory } from "./actions";

export function CategorySelect({
  id,
  value,
}: {
  id: string;
  value: FinanceCategory;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <select
      value={value}
      disabled={pending}
      onChange={(event) => {
        const nextValue = event.target.value as FinanceCategory;
        startTransition(() => updateTransactionCategory(id, nextValue));
      }}
      className="rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
    >
      {FINANCE_CATEGORIES.map((category) => (
        <option key={category} value={category}>
          {category}
        </option>
      ))}
    </select>
  );
}
