// Prisma's startsWith / endsWith / contains become SQL LIKE without escaping
// `_` and `%`, so `startsWith: "__"` matches any text of two or more
// characters. Pass literal prefixes through likeLiteral(). Postgres's
// default LIKE escape character is the backslash. Tested in tests/sql-like.test.ts.

export function likeLiteral(text: string): string {
  return text.replace(/[\\_%]/g, (c) => `\\${c}`);
}
