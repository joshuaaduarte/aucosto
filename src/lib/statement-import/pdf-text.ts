import { inflateSync } from "node:zlib";

function decodePdfString(value: string): string {
  return value
    .replace(/\\([\\()])/g, "$1")
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, "\r")
    .replace(/\\t/g, "\t")
    .replace(/\\b/g, "\b")
    .replace(/\\f/g, "\f")
    .replace(/\\([0-7]{1,3})/g, (_, octal: string) =>
      String.fromCharCode(Number.parseInt(octal, 8)),
    );
}

function extractTextOperators(source: string): string[] {
  const parts: string[] = [];

  for (const match of source.matchAll(/\((?:\\.|[^\\()])*\)\s*Tj/g)) {
    parts.push(decodePdfString(match[0].replace(/\s*Tj$/, "").slice(1, -1)));
  }

  for (const match of source.matchAll(/\[([\s\S]*?)\]\s*TJ/g)) {
    for (const stringMatch of match[1].matchAll(/\((?:\\.|[^\\()])*\)/g)) {
      parts.push(decodePdfString(stringMatch[0].slice(1, -1)));
    }
  }

  return parts;
}

function normalizeText(parts: string[]): string {
  return parts
    .join("\n")
    .replace(/\r/g, "\n")
    .replace(/\u0000/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function extractPdfText(bytes: Uint8Array): string {
  const raw = Buffer.from(bytes).toString("latin1");
  const parts: string[] = [];
  const streamPattern = /<<(.*?)>>\s*stream\r?\n([\s\S]*?)\r?\nendstream/g;

  for (const match of raw.matchAll(streamPattern)) {
    const dict = match[1];
    const streamSource = match[2];
    let stream = Buffer.from(streamSource, "latin1");

    if (/\/FlateDecode/.test(dict)) {
      try {
        stream = inflateSync(stream);
      } catch {
        continue;
      }
    }

    parts.push(...extractTextOperators(stream.toString("latin1")));
  }

  if (parts.length === 0) {
    parts.push(...extractTextOperators(raw));
  }

  return normalizeText(parts);
}
