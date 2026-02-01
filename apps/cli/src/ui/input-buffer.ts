import { StringDecoder } from "node:string_decoder";

/**
 * Captures keystrokes from stdin in raw mode while the agent is processing.
 * Detects Ctrl+C / Escape for interrupt and buffers printable characters
 * so they can pre-fill the next prompt.
 */
export class InputBuffer {
  private buffer = "";
  private active = false;
  private onInterrupt: (() => void) | null = null;
  private dataHandler: ((chunk: Buffer) => void) | null = null;

  /**
   * Start capturing keystrokes in raw mode.
   * @param onInterrupt Called when Ctrl+C or Escape is pressed.
   */
  start(onInterrupt: () => void): void {
    if (this.active) return;

    this.active = true;
    this.buffer = "";
    this.onInterrupt = onInterrupt;

    const decoder = new StringDecoder("utf8");

    this.dataHandler = (chunk: Buffer) => {
      for (let i = 0; i < chunk.length; i++) {
        const byte = chunk[i];

        // Ctrl+C
        if (byte === 0x03) {
          this.onInterrupt?.();
          return;
        }

        // Escape
        if (byte === 0x1b) {
          this.onInterrupt?.();
          return;
        }

        // Backspace / Delete
        if (byte === 0x7f || byte === 0x08) {
          this.buffer = this.buffer.slice(0, -1);
          continue;
        }

        // Enter — ignore during buffering (don't auto-submit)
        if (byte === 0x0d || byte === 0x0a) {
          continue;
        }

        // Printable ASCII and multi-byte UTF-8
        if (byte >= 0x20) {
          this.buffer += decoder.write(Buffer.from([byte]));
        }
      }
    };

    process.stdin.on("data", this.dataHandler);

    if (process.stdin.isTTY) {
      process.stdin.setRawMode(true);
    }
    process.stdin.resume();
  }

  /**
   * Stop capturing, exit raw mode, return buffered text.
   */
  stop(): string {
    if (!this.active) return "";

    this.active = false;

    if (this.dataHandler) {
      process.stdin.removeListener("data", this.dataHandler);
      this.dataHandler = null;
    }

    if (process.stdin.isTTY) {
      process.stdin.setRawMode(false);
    }

    this.onInterrupt = null;

    const text = this.buffer;
    this.buffer = "";
    return text;
  }

  /** Whether there is buffered content. */
  get hasContent(): boolean {
    return this.buffer.length > 0;
  }
}
