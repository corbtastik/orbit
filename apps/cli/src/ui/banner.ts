import chalk from "chalk";
import { colors } from "./theme.js";

// Gradient colors from terracotta through gold to sage
const g = [
  chalk.hex("#E07A5F"),  // terracotta
  chalk.hex("#E08A6F"),
  chalk.hex("#D9956F"),
  chalk.hex("#D4A373"),
  chalk.hex("#E0B880"),
  chalk.hex("#F2CC8F"),  // gold
  chalk.hex("#C4C89A"),
  chalk.hex("#A5C4A0"),
  chalk.hex("#90BDA0"),
  chalk.hex("#81B29A"),  // sage
];

function gradient(text: string, palette: typeof g): string {
  const chars = [...text];
  return chars
    .map((ch, i) => {
      if (ch === " " || ch === "\n") return ch;
      const color = palette[Math.floor((i / chars.length) * palette.length)];
      return color(ch);
    })
    .join("");
}

const LOGO = [
  `                  ●                  `,
  `            ○ ─ ─ ┼ ─ ─ ○            `,
  `        ·       · │ ·       ·        `,
  `      ○ ─ ─ ─ ● ─┼─ ● ─ ─ ─ ○      `,
  `        ·       · │ ·       ·        `,
  `            ○ ─ ─ ┼ ─ ─ ○            `,
  `                  ●                  `,
];

const WORDMARK = [
  `╔═══╗ ╔═══╗ ╔═══╗ ═╦═ ══╦══       ╔═══╗ ═╦═`,
  `║   ║ ║   ║ ║   ║  ║    ║         ║   ║  ║ `,
  `║   ║ ╠══╦╝ ╠═══╣  ║    ║   ═══   ╠═══╣  ║ `,
  `║   ║ ║  ║  ║   ║  ║    ║         ║   ║  ║ `,
  `╚═══╝ ╚  ╚═ ╚═══╝ ═╩═   ╩         ╩   ╩ ═╩═`,
];

/**
 * Print a block of lines centered as a unit (aligned to the longest line).
 */
function printBlock(lines: string[], width: number, palette: typeof g): void {
  const maxLen = Math.max(...lines.map((l) => l.length));
  const pad = Math.max(0, Math.floor((width - maxLen) / 2));
  for (const line of lines) {
    console.log(" ".repeat(pad) + gradient(line.padEnd(maxLen), palette));
  }
}

/**
 * Display the orbit-ai startup banner.
 */
export function printBanner(): void {
  const w = process.stdout.columns || 80;

  console.log();

  // Orbital diagram
  printBlock(LOGO, w, g);

  console.log();

  // Wordmark
  printBlock(WORDMARK, w, g);

  console.log();

  // Tagline
  const tagline = "MongoDB Atlas AI Shell";
  const tagPad = Math.max(0, Math.floor((w - tagline.length) / 2));
  console.log(" ".repeat(tagPad) + colors.dim(tagline));

  console.log();

  // Hint
  const hint = "Type natural language to manage Atlas. Ctrl+C to exit.";
  const hintPad = Math.max(0, Math.floor((w - hint.length) / 2));
  console.log(" ".repeat(hintPad) + colors.dim(hint));

  console.log();
}
