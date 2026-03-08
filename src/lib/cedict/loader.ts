import type { CedictEntry, CedictIndex } from "./types";

let cedictIndex: CedictIndex | null = null;

export function parseCedictLine(line: string): CedictEntry | null {
  const match = line.match(/^(\S+)\s+(\S+)\s+\[(.+?)\]\s+\/(.+?)\//);
  if (!match) {
    return null;
  }

  return {
    traditional: match[1],
    simplified: match[2],
    pinyin: match[3].trim(),
    meanings: match[4]
      .split("/")
      .map((part) => part.trim())
      .filter(Boolean),
  };
}

export async function loadCedict(): Promise<CedictIndex> {
  if (cedictIndex) {
    return cedictIndex;
  }

  const response = await fetch("/data/cedict.txt");
  const text = await response.text();
  const index: CedictIndex = new Map();

  for (const line of text.split("\n")) {
    if (!line.trim() || line.startsWith("#")) {
      continue;
    }

    const entry = parseCedictLine(line);
    if (!entry) {
      continue;
    }

    if (!index.has(entry.simplified)) {
      index.set(entry.simplified, []);
    }
    index.get(entry.simplified)?.push(entry);

    if (!index.has(entry.traditional)) {
      index.set(entry.traditional, []);
    }
    index.get(entry.traditional)?.push(entry);
  }

  cedictIndex = index;
  return index;
}

export function resetCedictCache(): void {
  cedictIndex = null;
}
