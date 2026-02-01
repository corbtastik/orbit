import ora, { type Ora } from "ora";
import { colors, icons } from "./theme.js";

/**
 * Manages a single ora spinner for async operations.
 */
export class SpinnerManager {
  private spinner: Ora;

  constructor() {
    this.spinner = ora({
      color: "yellow",
      spinner: "dots",
    });
  }

  /** Show spinner with a tool execution message. */
  tool(toolName: string, action: string): void {
    this.spinner.text = colors.muted(
      `${icons.tool} ${toolName} ${colors.dim(`→ ${action}`)}`,
    );
    this.spinner.start();
  }

  /** Show spinner with a thinking message. */
  thinking(): void {
    this.spinner.text = colors.muted(`${icons.thinking} Thinking...`);
    this.spinner.start();
  }

  /** Show spinner with custom text. */
  start(text: string): void {
    this.spinner.text = colors.muted(text);
    this.spinner.start();
  }

  /** Stop spinner with success indicator. */
  succeed(text?: string): void {
    if (text) {
      this.spinner.succeed(colors.secondary(text));
    } else {
      this.spinner.stop();
    }
  }

  /** Stop spinner with error indicator. */
  fail(text?: string): void {
    if (text) {
      this.spinner.fail(colors.error(text));
    } else {
      this.spinner.stop();
    }
  }

  /** Stop spinner silently. */
  stop(): void {
    this.spinner.stop();
  }

  /** Check if spinner is currently active. */
  get isSpinning(): boolean {
    return this.spinner.isSpinning;
  }
}
