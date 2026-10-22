import { ID_PREFIX } from "./naming";

const ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";

export function randomId(prefix: string, len = 6): string {
  let s = "";
  for (let i = 0; i < len; i++) s += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  return `${prefix}_${s}`;
}

/** @deprecated Prefer `ID_PREFIX` from naming — kept for existing imports. */
export const PREFIX: Record<string, string> = { ...ID_PREFIX };

export function idFor(kind: string): string {
  return randomId(ID_PREFIX[kind] ?? "nd");
}
