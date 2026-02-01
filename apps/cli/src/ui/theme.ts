import chalk from "chalk";

/** Color palette — warm, professional, inspired by terminal tools. */
export const colors = {
  primary: chalk.hex("#E07A5F"),     // terracotta — prompts, headings
  secondary: chalk.hex("#81B29A"),   // sage green — success, tool names
  accent: chalk.hex("#F2CC8F"),      // warm gold — highlights, warnings
  muted: chalk.gray,                 // gray — timestamps, metadata
  error: chalk.hex("#E07A5F").bold,  // bold terracotta — errors
  text: chalk.white,                 // default text
  dim: chalk.dim,                    // dimmed secondary info
  bold: chalk.bold,                  // emphasis
  code: chalk.hex("#81B29A"),        // code blocks
};

/** Icons for visual indicators. */
export const icons = {
  orbit: "\u25C9",       // ◉ — orbit dot
  prompt: "\u276F",      // ❯ — input prompt
  tool: "\u2726",        // ✦ — tool execution
  success: "\u2714",     // ✔ — success
  error: "\u2718",       // ✘ — error
  info: "\u25CB",        // ○ — info
  thinking: "\u2022",    // • — thinking
  arrow: "\u2192",       // → — arrow
};
