"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
  type TextareaHTMLAttributes,
} from "react";

type PersonSuggestion = {
  id: string;
  displayName: string;
  aliases: string[];
  relationshipType: string | null;
  organization: string | null;
};

type MentionTextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  helperText?: string;
};

let cachedPeople: PersonSuggestion[] | null = null;
let pendingPeople: Promise<PersonSuggestion[]> | null = null;

async function loadPeople(): Promise<PersonSuggestion[]> {
  if (cachedPeople) return cachedPeople;
  if (!pendingPeople) {
    pendingPeople = fetch("/api/rolodex/mention-suggestions", {
      credentials: "same-origin",
    })
      .then((res) => (res.ok ? res.json() : { people: [] }))
      .then((data) => {
        cachedPeople = Array.isArray(data.people) ? data.people : [];
        return cachedPeople ?? [];
      })
      .catch(() => []);
  }
  return pendingPeople;
}

function activeMention(value: string, caret: number) {
  const before = value.slice(0, caret);
  const bracket = before.match(/(^|[\s([{])@\[([^\]\n]*)$/);
  if (bracket?.index !== undefined) {
    return {
      start: bracket.index + (bracket[1] ?? "").length,
      end: caret,
      query: bracket[2] ?? "",
      bracketed: true,
    };
  }
  const bare = before.match(/(^|[\s([{])@([A-Za-z0-9.'-]*)$/);
  if (bare?.index !== undefined) {
    return {
      start: bare.index + (bare[1] ?? "").length,
      end: caret,
      query: bare[2] ?? "",
      bracketed: false,
    };
  }
  return null;
}

export const MentionTextarea = forwardRef<HTMLTextAreaElement, MentionTextareaProps>(
  function MentionTextarea({ helperText, onChange, onKeyDown, className, ...props }, ref) {
    const innerRef = useRef<HTMLTextAreaElement | null>(null);
    const [people, setPeople] = useState<PersonSuggestion[]>(cachedPeople ?? []);
    const [mention, setMention] = useState<ReturnType<typeof activeMention>>(null);
    const [activeIndex, setActiveIndex] = useState(0);

    useImperativeHandle(ref, () => innerRef.current as HTMLTextAreaElement);

    useEffect(() => {
      void loadPeople().then(setPeople);
    }, []);

    const suggestions = useMemo(() => {
      if (!mention) return [];
      const query = mention.query.toLowerCase();
      return people
        .filter((person) => {
          const haystack = [
            person.displayName,
            person.relationshipType ?? "",
            person.organization ?? "",
            ...person.aliases,
          ]
            .join(" ")
            .toLowerCase();
          return !query || haystack.includes(query);
        })
        .slice(0, 5);
    }, [mention, people]);

    function refreshMention(target: HTMLTextAreaElement) {
      setMention(activeMention(target.value, target.selectionStart ?? target.value.length));
      setActiveIndex(0);
    }

    function handleChange(event: ChangeEvent<HTMLTextAreaElement>) {
      refreshMention(event.currentTarget);
      onChange?.(event);
    }

    function choose(person: PersonSuggestion) {
      const textarea = innerRef.current;
      if (!textarea || !mention) return;
      const insert = person.displayName.includes(" ")
        ? `@[${person.displayName}]`
        : `@${person.displayName}`;
      const nextValue =
        textarea.value.slice(0, mention.start) +
        insert +
        " " +
        textarea.value.slice(mention.end);
      const nativeSetter = Object.getOwnPropertyDescriptor(
        window.HTMLTextAreaElement.prototype,
        "value",
      )?.set;
      nativeSetter?.call(textarea, nextValue);
      const nextCaret = mention.start + insert.length + 1;
      textarea.dispatchEvent(new Event("input", { bubbles: true }));
      requestAnimationFrame(() => {
        textarea.focus();
        textarea.setSelectionRange(nextCaret, nextCaret);
      });
      setMention(null);
    }

    function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
      if (suggestions.length > 0) {
        if (event.key === "ArrowDown") {
          event.preventDefault();
          setActiveIndex((index) => (index + 1) % suggestions.length);
          return;
        }
        if (event.key === "ArrowUp") {
          event.preventDefault();
          setActiveIndex((index) => (index - 1 + suggestions.length) % suggestions.length);
          return;
        }
        if (event.key === "Enter" || event.key === "Tab") {
          event.preventDefault();
          const selected = suggestions[activeIndex] ?? suggestions[0];
          if (selected) choose(selected);
          return;
        }
        if (event.key === "Escape") {
          setMention(null);
          return;
        }
      }
      onKeyDown?.(event);
    }

    return (
      <div className="relative">
        <textarea
          {...props}
          ref={innerRef}
          className={className}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onClick={(event) => refreshMention(event.currentTarget)}
          onKeyUp={(event) => refreshMention(event.currentTarget)}
        />
        {mention ? (
          <div
            className="absolute left-2 right-2 top-full z-40 mt-1 overflow-hidden rounded-md border shadow-lg"
            style={{ background: "var(--bg-page)", borderColor: "var(--border-soft)" }}
          >
            {suggestions.length > 0 ? (
              suggestions.map((person, index) => (
                <button
                  key={person.id}
                  type="button"
                  className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-[0.8125rem]"
                  style={{
                    background: index === activeIndex ? "var(--bg-hover)" : "transparent",
                    color: "var(--text)",
                  }}
                  onMouseDown={(event) => {
                    event.preventDefault();
                    choose(person);
                  }}
                >
                  <span className="font-medium">@{person.displayName}</span>
                  <span className="truncate text-[0.75rem]" style={{ color: "var(--text-muted)" }}>
                    {[person.relationshipType, person.organization].filter(Boolean).join(" · ")}
                  </span>
                </button>
              ))
            ) : (
              <div className="px-3 py-2 text-[0.8125rem]" style={{ color: "var(--text-muted)" }}>
                No match yet. Saving will create an unresolved mention.
              </div>
            )}
          </div>
        ) : null}
        {helperText ? (
          <p className="mt-1 text-[0.75rem]" style={{ color: "var(--text-faint)" }}>
            {helperText}
          </p>
        ) : null}
      </div>
    );
  },
);
