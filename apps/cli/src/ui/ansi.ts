/**
 * ANSI escape code utilities.
 *
 * Shared helpers for terminal manipulation used across UI components.
 */

// ── Cursor positioning ─────────────────────────────────────────────────

/** Move cursor to specified row and column (1-indexed). */
export const cursorTo = (row: number, col: number): string => `\x1b[${row};${col}H`;

/** Save cursor position. */
export const cursorSave = `\x1b7`;

/** Restore cursor position. */
export const cursorRestore = `\x1b8`;

// ── Line manipulation ──────────────────────────────────────────────────

/** Erase entire current line. */
export const eraseLine = `\x1b[2K`;

// ── Scroll region ──────────────────────────────────────────────────────

/** Set scroll region (1-indexed, inclusive). */
export const setScrollRegion = (top: number, bottom: number): string =>
  `\x1b[${top};${bottom}r`;

/** Reset scroll region to full terminal. */
export const resetScrollRegion = `\x1b[r`;

// ── Text utilities ─────────────────────────────────────────────────────

/**
 * Strip ANSI escape codes from text.
 *
 * Useful for calculating visible string length.
 */
export function stripAnsi(text: string): string {
  // eslint-disable-next-line no-control-regex
  return text.replace(/\x1b\[[0-9;]*m/g, "");
}
