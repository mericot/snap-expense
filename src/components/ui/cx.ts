/**
 * Minimal class-name joiner. Deliberately not `clsx` / `tailwind-merge` — this
 * project takes no new dependencies, and the primitives here never need class
 * conflict resolution because callers only ever append.
 */
export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ')
}
