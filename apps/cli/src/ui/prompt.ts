import { createInterface, type Interface } from "node:readline";
import { colors, icons } from "./theme.js";
import type { ScreenManager } from "./screen.js";
import type { CommandPalette } from "./command-palette.js";

/**
 * Readline-based prompt with command history, type-ahead, and command palette.
 *
 * Keeps readline active at all times — even during agent processing — so the
 * user can scroll through history (up arrow) and type ahead for the next turn.
 * Lines submitted during processing are queued and returned by the next read().
 */
export class Prompt {
  private rl: Interface;
  private closed = false;
  private screen: ScreenManager | null;
  private palette: CommandPalette | null;
  private keypressHandler: ((str: string, key: KeyInfo) => void) | null = null;

  /** Lines submitted by the user that haven't been consumed by read() yet. */
  private pendingLines: string[] = [];
  /** Resolve function for the current read() Promise, or null. */
  private pendingResolve: ((value: string | null) => void) | null = null;
  /** Whether an rl.question() is currently active. */
  private questionActive = false;
  /** Callback for Ctrl+C / Escape interrupt. */
  private interruptCb: (() => void) | null = null;

  private readonly promptStr: string;

  constructor(screen?: ScreenManager, palette?: CommandPalette) {
    this.screen = screen ?? null;
    this.palette = palette ?? null;
    this.promptStr = `${colors.primary(icons.prompt)} `;

    const completer = palette
      ? (line: string): [string[], string] => {
          if (line.startsWith("/")) {
            const completions = palette.getCompletions(line);
            return [completions, line];
          }
          return [[], line];
        }
      : undefined;

    this.rl = createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: true,
      historySize: 100,
      prompt: this.promptStr,
      completer,
    });

    this.rl.on("close", () => {
      this.closed = true;
      if (this.pendingResolve) {
        const resolve = this.pendingResolve;
        this.pendingResolve = null;
        resolve(null);
      }
    });

    // Handle Ctrl+C via readline's SIGINT event.
    // In terminal mode, readline intercepts Ctrl+C and emits 'SIGINT'
    // instead of propagating a process-level SIGINT signal.
    this.rl.on("SIGINT", () => {
      if (this.interruptCb) {
        this.interruptCb();
      }
      // SIGINT cancels the current question in some Node versions.
      // Re-start the question loop to keep the prompt active.
      this.questionActive = false;
      if (!this.closed) {
        this.askQuestion();
      }
    });

    // Set up keypress listener for command palette and Escape detection
    this.setupKeypressHandler();

    // Override _ttyWrite to intercept arrow keys / Enter / Tab when palette is visible
    this.setupPaletteKeyOverride();

    // Start the first question immediately — the prompt is always active.
    this.askQuestion();
  }

  /**
   * Read a line of input from the user.
   * Returns null if the prompt is closed (Ctrl+D).
   * If prefill is provided, the prompt starts with that text pre-filled.
   */
  async read(prefill?: string): Promise<string | null> {
    if (this.closed) return null;

    // If we have queued input from type-ahead during processing, return it
    if (this.pendingLines.length > 0) {
      return this.pendingLines.shift()!;
    }

    // Pre-fill the line if text was buffered
    if (prefill) {
      this.rl.write(prefill);
    }

    // Wait for the next submitted line
    return new Promise<string | null>((resolve) => {
      this.pendingResolve = resolve;
    });
  }

  /**
   * Set the interrupt handler for Ctrl+C / Escape.
   * Called both during idle (double Ctrl+C exit) and processing (cancel).
   * Pass null to clear.
   */
  onInterrupt(handler: (() => void) | null): void {
    this.interruptCb = handler;
  }

  /** Close the prompt permanently. */
  close(): void {
    this.closed = true;
    if (this.keypressHandler) {
      process.stdin.removeListener("keypress", this.keypressHandler);
      this.keypressHandler = null;
    }
    this.rl.close();
  }

  // ── Private ──────────────────────────────────────────────────────────

  /**
   * Start a readline question. When answered, the line is either resolved
   * to a pending read() call or queued for the next read().
   * Automatically re-starts after each answer for continuous input.
   */
  private askQuestion(): void {
    if (this.closed || this.questionActive) return;

    this.questionActive = true;

    // Position cursor at fixed prompt row when screen is active
    if (this.screen) {
      this.screen.preparePromptRow();
    }

    this.rl.question(this.promptStr, (answer) => {
      this.questionActive = false;

      // Hide palette on submit
      if (this.palette) {
        this.palette.hide();
      }

      const trimmed = answer.trim() || null;

      if (this.pendingResolve && trimmed) {
        // read() is waiting — resolve it
        const resolve = this.pendingResolve;
        this.pendingResolve = null;
        resolve(trimmed);
      } else if (trimmed) {
        // Nobody's waiting (during processing) — queue for next read()
        this.pendingLines.push(trimmed);
      }
      // Empty input (just Enter) — ignore, just re-prompt.

      // Start next question immediately for continuous input
      if (!this.closed) {
        this.askQuestion();
      }
    });
  }

  /**
   * Override readline's internal _ttyWrite to intercept keys when the
   * command palette is visible.  When visible:
   *   Up/Down  → navigate palette (suppress history scroll)
   *   Enter    → replace line with selected command, then submit
   *   Tab      → complete line with selected command (no submit)
   *   Escape   → hide palette (falls through to keypress handler)
   */
  private setupPaletteKeyOverride(): void {
    if (!this.palette) return;

    const rl = this.rl as unknown as {
      _ttyWrite: (s: string, key: KeyInfo) => void;
    };
    const original = rl._ttyWrite.bind(this.rl);

    rl._ttyWrite = (s: string, key: KeyInfo) => {
      if (this.palette!.isVisible) {
        if (key?.name === "up") {
          this.palette!.moveUp();
          return;
        }
        if (key?.name === "down") {
          this.palette!.moveDown();
          return;
        }
        if (key?.name === "return") {
          const selected = this.palette!.getSelected();
          if (selected) {
            this.replaceLine(selected);
          }
          // Let Enter propagate to submit the line
          original(s, key);
          return;
        }
        if (key?.name === "tab") {
          const selected = this.palette!.getSelected();
          if (selected) {
            this.replaceLine(selected);
            this.palette!.update(selected);
          }
          // Don't propagate tab (avoid readline's default completer)
          return;
        }
      }
      original(s, key);
    };
  }

  /** Replace the current readline input with new text. */
  private replaceLine(text: string): void {
    // Ctrl+U clears the line, then write new text
    this.rl.write(null, { ctrl: true, name: "u" });
    this.rl.write(text);
  }

  /** Set up keypress handler for command palette and Escape detection. */
  private setupKeypressHandler(): void {
    this.keypressHandler = (_str: string, key: KeyInfo) => {
      // Escape key — trigger interrupt callback
      if (key?.name === "escape" && this.interruptCb) {
        this.interruptCb();
        return;
      }

      // Command palette: update on every keypress
      if (this.palette) {
        // Use setImmediate so readline processes the key first,
        // then we check the updated line buffer.
        setImmediate(() => {
          if (this.closed) return;
          const line = this.getCurrentLine();
          if (line.startsWith("/")) {
            this.palette!.update(line);
          } else {
            this.palette!.hide();
          }
        });
      }
    };
    process.stdin.on("keypress", this.keypressHandler);
  }

  /** Get the current readline input buffer via the internal `line` property. */
  private getCurrentLine(): string {
    // Node.js readline.Interface exposes `line` as a getter (Node 18+).
    // TypeScript definitions don't include it, so we cast through unknown.
    return (this.rl as unknown as { line: string }).line ?? "";
  }
}

/** Keypress event info from Node's readline. */
interface KeyInfo {
  sequence?: string;
  name?: string;
  ctrl?: boolean;
  meta?: boolean;
  shift?: boolean;
}
