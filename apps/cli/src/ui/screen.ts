import { Writable } from "node:stream";
import { colors } from "./theme.js";

/** Content displayed in the status bar. */
export interface StatusBarContent {
  left: string;
  right: string;
}

/** Screen state affects what the status bar displays. */
export type ScreenState = "idle" | "processing";

// ── ANSI escape helpers ──────────────────────────────────────────────

const setScrollRegion = (top: number, bottom: number) =>
  `\x1b[${top};${bottom}r`;
const resetScrollRegion = `\x1b[r`;
const cursorTo = (row: number, col: number) => `\x1b[${row};${col}H`;
const cursorSave = `\x1b7`;       // DEC save — used for readline cursor
const cursorRestore = `\x1b8`;    // DEC restore
const cursorSaveSCO = `\x1b[s`;   // SCO save — used for scroll region cursor
const cursorRestoreSCO = `\x1b[u`; // SCO restore
const eraseLine = `\x1b[2K`;

/** Strip ANSI escape codes for length calculation. */
function stripAnsi(text: string): string {
  // eslint-disable-next-line no-control-regex
  return text.replace(/\x1b\[[0-9;]*m/g, "");
}

/**
 * Manages a 3-zone terminal layout using ANSI scroll regions:
 *
 *   rows 1..N-3   — scrollable output area
 *   row  N-2      — separator line
 *   row  N-1      — prompt row (readline)
 *   row  N        — status bar
 *
 * When promptActive is true, readline owns the cursor at the prompt row.
 * Output writes temporarily switch to the scroll region using a dual
 * cursor-save strategy (DEC \x1b7 for readline, SCO \x1b[s for scroll).
 */
export class ScreenManager {
  private rows = 0;
  private cols = 0;
  private active = false;
  private screenState: ScreenState = "idle";
  private statusContent: StatusBarContent = { left: "", right: "" };
  private resizeTimer: ReturnType<typeof setTimeout> | null = null;
  private boundResize: (() => void) | null = null;

  /**
   * When true, readline is active at the prompt row and all output writes
   * save/restore the readline cursor around scroll region writes.
   */
  private _promptActive = false;

  /** Proxy stream for ora — routes writes into the scroll region. */
  readonly outputStream: Writable;

  constructor() {
    this.outputStream = this.createOutputProxy();
  }

  // ── Computed geometry ────────────────────────────────────────────

  private get scrollBottom(): number {
    return Math.max(1, this.rows - 3);
  }
  /** Row number of the separator line (public for palette positioning). */
  get separatorRow(): number {
    return this.rows - 2;
  }
  private get promptRow(): number {
    return this.rows - 1;
  }
  private get statusRow(): number {
    return this.rows;
  }

  /** Current terminal column count (public for palette rendering). */
  get termCols(): number {
    return this.cols;
  }

  // ── Lifecycle ────────────────────────────────────────────────────

  /**
   * Initialize the 3-zone layout.
   * Call after the banner has been printed to stdout.
   */
  setup(status: StatusBarContent): void {
    this.statusContent = status;
    this.updateDimensions();

    // Set scroll region to exclude the bottom 3 rows
    process.stdout.write(setScrollRegion(1, this.scrollBottom));
    // Position cursor at bottom of scroll region
    process.stdout.write(cursorTo(this.scrollBottom, 1));

    this.renderFooter();

    this.boundResize = () => this.handleResize();
    process.stdout.on("resize", this.boundResize);

    this.active = true;
  }

  /**
   * Tear down the layout, restoring normal terminal behavior.
   */
  teardown(): void {
    if (!this.active) return;
    this.active = false;
    this._promptActive = false;

    if (this.resizeTimer) {
      clearTimeout(this.resizeTimer);
      this.resizeTimer = null;
    }
    if (this.boundResize) {
      process.stdout.removeListener("resize", this.boundResize);
      this.boundResize = null;
    }

    // Reset scroll region to full terminal
    process.stdout.write(resetScrollRegion);
    // Move cursor to last row
    process.stdout.write(cursorTo(this.rows, 1));
    process.stdout.write("\n");
  }

  // ── Prompt-active mode ─────────────────────────────────────────

  /**
   * Enable or disable prompt-active mode.
   *
   * When enabled, readline owns the cursor at the prompt row and output
   * writes use dual cursor save/restore to write into the scroll region
   * without disturbing the prompt.
   */
  setPromptActive(active: boolean): void {
    if (active && !this._promptActive && this.active) {
      // Save initial scroll region cursor position using the SCO slot.
      // DEC save/restore is reserved for readline cursor.
      process.stdout.write(cursorSave);            // save readline cursor (DEC)
      process.stdout.write(cursorTo(this.scrollBottom, 1));
      process.stdout.write(cursorSaveSCO);          // save scroll cursor (SCO)
      process.stdout.write(cursorRestore);           // restore readline cursor (DEC)
    }
    this._promptActive = active;
  }

  // ── Output zone (scroll region) ─────────────────────────────────

  /**
   * Write text to the scroll region.
   * When promptActive, saves/restores readline cursor around the write.
   */
  writeToScrollRegion(text: string): void {
    if (!this.active) {
      process.stdout.write(text);
      return;
    }
    this.writeToScroll(text);
  }

  /**
   * Write a complete line to the scroll region (appends newline).
   */
  writeLine(text: string): void {
    this.writeToScrollRegion(text + "\n");
  }

  // ── Prompt zone (fixed row) ─────────────────────────────────────

  /**
   * Position cursor at the prompt row for readline input.
   * Call before rl.question().
   */
  preparePromptRow(): void {
    if (!this.active) return;
    process.stdout.write(cursorTo(this.promptRow, 1));
    process.stdout.write(eraseLine);
  }

  /**
   * Clear the prompt row after user submits input.
   */
  clearPromptRow(): void {
    if (!this.active) return;
    process.stdout.write(cursorSave);
    process.stdout.write(cursorTo(this.promptRow, 1));
    process.stdout.write(eraseLine);
    process.stdout.write(cursorRestore);
  }

  /**
   * Move cursor into the scroll region for output.
   * No-op when promptActive (cursor management handled by writeToScroll).
   */
  enterScrollRegion(): void {
    if (!this.active || this._promptActive) return;
    process.stdout.write(cursorTo(this.scrollBottom, 1));
  }

  // ── Status bar ──────────────────────────────────────────────────

  /**
   * Update the screen state, which changes status bar content.
   */
  setScreenState(state: ScreenState): void {
    this.screenState = state;
    const left =
      state === "processing"
        ? "  Esc to cancel"
        : this.statusContent.left;
    this.renderStatusBar(left, this.statusContent.right);
  }

  /**
   * Update the status bar content and re-render.
   */
  updateStatusBar(content: StatusBarContent): void {
    this.statusContent = content;
    this.setScreenState(this.screenState);
  }

  // ── Private rendering ───────────────────────────────────────────

  private updateDimensions(): void {
    this.rows = process.stdout.rows || 24;
    this.cols = process.stdout.columns || 80;
  }

  /**
   * Write data to the scroll region. When promptActive, uses dual
   * cursor save/restore to preserve readline's cursor position.
   *
   * DEC save (\x1b7) — readline cursor (prompt row)
   * SCO save (\x1b[s) — scroll region cursor (output position)
   */
  private writeToScroll(data: string | Buffer): void {
    if (this._promptActive) {
      process.stdout.write(cursorSave);        // save readline cursor (DEC)
      process.stdout.write(cursorRestoreSCO);   // restore scroll cursor (SCO)
      process.stdout.write(data.toString());
      process.stdout.write(cursorSaveSCO);      // save scroll cursor (SCO)
      process.stdout.write(cursorRestore);       // restore readline cursor (DEC)
    } else {
      process.stdout.write(data);
    }
  }

  /** Render the entire fixed footer: separator + empty prompt + status bar. */
  private renderFooter(): void {
    process.stdout.write(cursorSave);

    // Separator
    process.stdout.write(cursorTo(this.separatorRow, 1));
    process.stdout.write(eraseLine);
    process.stdout.write(colors.dim("\u2500".repeat(this.cols)));

    // Prompt row (empty placeholder — readline fills it)
    process.stdout.write(cursorTo(this.promptRow, 1));
    process.stdout.write(eraseLine);

    // Status bar
    this.renderStatusBarAt(this.statusContent.left, this.statusContent.right);

    process.stdout.write(cursorRestore);
  }

  private renderStatusBar(left: string, right: string): void {
    if (!this.active) return;
    process.stdout.write(cursorSave);
    this.renderStatusBarAt(left, right);
    process.stdout.write(cursorRestore);
  }

  /** Render status bar at the status row (caller manages cursor save/restore). */
  private renderStatusBarAt(left: string, right: string): void {
    process.stdout.write(cursorTo(this.statusRow, 1));
    process.stdout.write(eraseLine);

    const renderedLeft = colors.dim(left);
    const renderedRight = colors.dim(right);
    const leftLen = stripAnsi(left).length;
    const rightLen = stripAnsi(right).length;
    const gap = Math.max(1, this.cols - leftLen - rightLen);

    process.stdout.write(renderedLeft + " ".repeat(gap) + renderedRight);
  }

  // ── Resize handling ─────────────────────────────────────────────

  private handleResize(): void {
    // Debounce rapid resize events
    if (this.resizeTimer) clearTimeout(this.resizeTimer);
    this.resizeTimer = setTimeout(() => {
      this.resizeTimer = null;
      this.updateDimensions();

      // Reset and re-establish scroll region
      process.stdout.write(resetScrollRegion);
      process.stdout.write(setScrollRegion(1, this.scrollBottom));

      // Re-render footer at new positions
      this.renderFooter();

      if (this._promptActive) {
        // Re-save scroll cursor at new scrollBottom, then restore to prompt row
        process.stdout.write(cursorTo(this.scrollBottom, 1));
        process.stdout.write(cursorSaveSCO);
        process.stdout.write(cursorTo(this.promptRow, 1));
      } else {
        // Position cursor in scroll region
        process.stdout.write(cursorTo(this.scrollBottom, 1));
      }
    }, 100);
  }

  // ── Ora proxy stream ────────────────────────────────────────────

  /**
   * Create a Writable stream that routes all writes through the scroll region.
   * Also implements cursorTo/moveCursor/clearLine for ora compatibility.
   * Uses writeToScroll for prompt-active safe output.
   */
  private createOutputProxy(): Writable {
    const self = this;

    const proxy = new Writable({
      write(chunk, _encoding, callback) {
        if (self.active) {
          self.writeToScroll(chunk);
        } else {
          process.stdout.write(chunk);
        }
        callback();
      },
    });

    // ora checks stream.isTTY
    Object.defineProperty(proxy, "isTTY", { get: () => true });

    // ora reads stream.columns for wrapping
    Object.defineProperty(proxy, "columns", {
      get: () => self.cols || process.stdout.columns || 80,
    });

    // ora calls stream.cursorTo(0) to reset to line start
    (proxy as unknown as Record<string, unknown>).cursorTo = (
      x: number,
      _y?: number,
    ): boolean => {
      const seq = x === 0 ? "\r" : `\r\x1b[${x}C`;
      self.writeToScroll(seq);
      return true;
    };

    // ora calls stream.moveCursor(dx, dy) for multiline spinner
    (proxy as unknown as Record<string, unknown>).moveCursor = (
      dx: number,
      dy: number,
    ): boolean => {
      let seq = "";
      if (dy < 0) seq += `\x1b[${Math.abs(dy)}A`;
      if (dy > 0) seq += `\x1b[${dy}B`;
      if (dx > 0) seq += `\x1b[${dx}C`;
      if (dx < 0) seq += `\x1b[${Math.abs(dx)}D`;
      if (seq) self.writeToScroll(seq);
      return true;
    };

    // ora calls stream.clearLine(dir) to erase spinner frame
    (proxy as unknown as Record<string, unknown>).clearLine = (
      dir: number,
    ): boolean => {
      let seq: string;
      switch (dir) {
        case -1:
          seq = `\x1b[1K`;
          break;
        case 0:
          seq = eraseLine;
          break;
        case 1:
        default:
          seq = `\x1b[K`;
          break;
      }
      self.writeToScroll(seq);
      return true;
    };

    return proxy;
  }
}
