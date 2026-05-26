import type { DemoSentence } from "@/lib/demoData";

/**
 * Tiny localStorage helper for the custom-sentence library.
 *
 * The user can write their own sentence in RU / UZ / EN; /api/translate
 * turns it into a DemoSentence-compatible record, and we keep the last
 * five of those around so they can be re-selected instantly without
 * paying the 4-10s LLM round-trip again. Order is newest-first.
 *
 * Stored entries also carry a `translation` field (the original L1
 * text) and `createdAt` so the dropdown can show the source language
 * preview and time, and a `sourceL1` so we know which input language
 * the user typed.
 */

const STORAGE_KEY = "mirror-custom-sentences";
const MAX_ENTRIES = 5;
const SCHEMA_VERSION = 1;

export interface LibraryEntry extends DemoSentence {
  /** Original user input (RU / UZ / EN). */
  translation: string;
  /** Which native language the user typed in. */
  sourceL1: "russian" | "uzbek" | "english";
  /** ms epoch of when the translation finished. */
  createdAt: number;
}

interface StoredShape {
  version: number;
  entries: LibraryEntry[];
}

function readStore(): StoredShape {
  if (typeof window === "undefined") return { version: SCHEMA_VERSION, entries: [] };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { version: SCHEMA_VERSION, entries: [] };
    const parsed = JSON.parse(raw) as StoredShape;
    if (!parsed || parsed.version !== SCHEMA_VERSION) {
      // Schema bumped — drop everything rather than try to migrate.
      // Five entries lost is a cheap price for forward compatibility.
      return { version: SCHEMA_VERSION, entries: [] };
    }
    if (!Array.isArray(parsed.entries)) return { version: SCHEMA_VERSION, entries: [] };
    return parsed;
  } catch {
    return { version: SCHEMA_VERSION, entries: [] };
  }
}

function writeStore(store: StoredShape): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    // Quota exceeded or storage disabled — silently ignore. The
    // library is a convenience, not the source of truth, so a
    // dropped write just means the user re-translates next time.
  }
}

/** Returns the saved library entries, newest-first. */
export function loadLibrary(): LibraryEntry[] {
  return readStore().entries;
}

/** Prepend an entry, dedupe by hanzi, cap at MAX_ENTRIES. */
export function saveLibraryEntry(entry: LibraryEntry): LibraryEntry[] {
  const store = readStore();
  const deduped = store.entries.filter((e) => e.hanzi !== entry.hanzi);
  const next: LibraryEntry[] = [entry, ...deduped].slice(0, MAX_ENTRIES);
  writeStore({ version: SCHEMA_VERSION, entries: next });
  return next;
}

/** Remove a single entry by id. Used by the "× remove" affordance. */
export function removeLibraryEntry(id: string): LibraryEntry[] {
  const store = readStore();
  const next = store.entries.filter((e) => e.id !== id);
  writeStore({ version: SCHEMA_VERSION, entries: next });
  return next;
}

/** Wipe everything. Used by the "Clear history" affordance. */
export function clearLibrary(): void {
  writeStore({ version: SCHEMA_VERSION, entries: [] });
}
