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
   * If prefill is provided, the prompt starts with that text pre-filled.
   */
  async read(prefill?: string): Promise<string | null> {
    if (this.closed) return null;

    return new Promise<string | null>((resolve) => {
      const onClose = () => resolve(null);

      this.rl.question(`${colors.primary(icons.prompt)} `, (answer) => {
        this.rl.removeListener("close", onClose);
        resolve(answer.trim() || null);
      });

      // Pre-fill the line with buffered input from previous turn
      if (prefill) {
        this.rl.write(prefill);
      }

      // Handle close during question
      this.rl.once("close", onClose);
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
