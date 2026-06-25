export interface ParsedMention {
  name: string;
  start: number;
  end: number;
}

/**
 * Extract all @mentions from a string.
 * Rules:
 * - @ must be preceded by start-of-string, whitespace, or punctuation (not a word char)
 * - Bracket form: @[Full Name] — inserted by the mention picker for names with spaces
 * - Bare form: @Word or @First Last (second word must start with uppercase)
 * - Returns deduplicated names (case-sensitive, first occurrence wins for position)
 * - Ignores email@domain.com patterns
 */
export function parseMentions(text: string): ParsedMention[] {
  // (?<![a-zA-Z0-9_]) — not preceded by a word character (excludes email@domain)
  // @(?:\[([^\]\n]+)\]|...) — bracket form @[Full Name] OR bare form
  // ([a-zA-Z]\w*) — first word of a bare mention starting with a letter
  // (?:\s+([A-Z]\w*))? — optionally a space + capitalized second word (bare form only)
  const re = /(?<![a-zA-Z0-9_])@(?:\[([^\]\n]+)\]|([a-zA-Z]\w*)(?:\s+([A-Z]\w*))?)/g;
  const seen = new Set<string>();
  const results: ParsedMention[] = [];

  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    // match[1] = bracket content (e.g. "Ana Duarte") — present for @[...] form
    // match[2] = first word (e.g. "Ana") — present for bare form
    // match[3] = optional second word (e.g. "Duarte") — bare two-word form only
    let name: string;
    if (match[1] !== undefined) {
      name = match[1].trim();
    } else {
      const first = match[2]!;
      const second = match[3];
      name = second ? `${first} ${second}` : first;
    }

    if (!name || seen.has(name)) continue;
    seen.add(name);

    results.push({
      name,
      start: match.index,
      end: match.index + match[0].length,
    });
  }

  return results;
}

/** Deduplicated mention names extracted from text — convenience wrapper over parseMentions. */
export function mentionNames(text: string): string[] {
  return parseMentions(text).map((m) => m.name);
}
