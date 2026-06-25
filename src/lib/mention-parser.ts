export interface ParsedMention {
  name: string;
  start: number;
  end: number;
}

/**
 * Extract all @mentions from a string.
 * Rules:
 * - @ must be preceded by start-of-string, whitespace, or punctuation (not a word char)
 * - Name is one or two "words" (word = letters/digits/underscores/apostrophes)
 * - Two-word form "@Ana Duarte" only if the second word starts with uppercase
 * - Returns deduplicated names (case-sensitive, first occurrence wins for position)
 * - Ignores email@domain.com patterns
 */
export function parseMentions(text: string): ParsedMention[] {
  // (?<![a-zA-Z0-9_]) — not preceded by a word character (excludes email@domain)
  // @([a-zA-Z]\w*) — @ followed by a name starting with a letter
  // (?:\s+([A-Z]\w*))? — optionally a space + capitalized second word
  const re = /(?<![a-zA-Z0-9_])@([a-zA-Z]\w*)(?:\s+([A-Z]\w*))?/g;
  const seen = new Set<string>();
  const results: ParsedMention[] = [];

  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    const first = match[1]!;
    const second = match[2];
    const name = second ? `${first} ${second}` : first;

    if (seen.has(name)) continue;
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
