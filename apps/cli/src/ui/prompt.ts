import { createInterface, type Interface } from "node:readline";
import { colors, icons } from "./theme.js";

/**
 * Readline-based prompt with command history.
 */
export class Prompt {
  private rl: Interface;
  private closed = false;

  constructor() {
    this.rl = createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: true,
      historySize: 100,
      prompt: `${colors.primary(icons.prompt)} `,
    });

    this.rl.on("close", () => {
      this.closed = true;
    });
  }

  /**
   * Read a line of input from the user.
   * Returns null if the prompt is closed (Ctrl+C / Ctrl+D).
   */
  async read(): Promise<string | null> {
    if (this.closed) return null;

    return new Promise<string | null>((resolve) => {
      this.rl.question(`${colors.primary(icons.prompt)} `, (answer) => {
        resolve(answer.trim() || null);
      });

      // Handle close during question
      this.rl.once("close", () => resolve(null));
    });
  }

  /** Temporarily pause the prompt (e.g. during streaming output). */
  pause(): void {
    this.rl.pause();
  }

  /** Resume the prompt. */
  resume(): void {
    if (!this.closed) {
      this.rl.resume();
    }
  }

  /** Close the prompt permanently. */
  close(): void {
    this.closed = true;
    this.rl.close();
  }
}
