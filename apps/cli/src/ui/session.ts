import { InputBuffer } from "./input-buffer.js";
import { colors } from "./theme.js";

export type SessionState = "idle" | "processing" | "aborting" | "exiting";

/**
 * Manages the session lifecycle: abort controllers, input buffering,
 * and the state machine for interrupt handling.
 */
export class Session {
  private _state: SessionState = "idle";
  private abortController: AbortController | null = null;
  private inputBuffer: InputBuffer;
  private lastCtrlCTime = 0;

  constructor(inputBuffer: InputBuffer) {
    this.inputBuffer = inputBuffer;
  }

  get state(): SessionState {
    return this._state;
  }

  get shouldExit(): boolean {
    return this._state === "exiting";
  }

  /**
   * Transition to processing state. Creates a fresh AbortController
   * and starts the input buffer for keystroke capture.
   */
  startProcessing(): AbortSignal {
    this._state = "processing";
    this.abortController = new AbortController();

    this.inputBuffer.start(() => this.handleInterrupt());

    return this.abortController.signal;
  }

  /**
   * Called when agent turn completes (normally or via abort).
   * Stops the input buffer and returns any buffered text.
   */
  endProcessing(): string {
    this._state = "idle";
    const buffered = this.inputBuffer.stop();
    this.abortController = null;
    return buffered;
  }

  /**
   * Handle an interrupt (Ctrl+C / Escape).
   *
   * - During processing: abort the current stream
   * - During aborting: force exit (second Ctrl+C)
   * - During idle: double-tap Ctrl+C to exit
   */
  handleInterrupt(): void {
    switch (this._state) {
      case "processing":
        this._state = "aborting";
        this.abortController?.abort();
        process.stdout.write(colors.dim("\n  Cancelled.\n"));
        break;

      case "aborting":
        // Second interrupt while aborting — force exit
        this._state = "exiting";
        break;

      case "idle": {
        const now = Date.now();
        if (now - this.lastCtrlCTime < 500) {
          this._state = "exiting";
        } else {
          this.lastCtrlCTime = now;
          process.stdout.write(
            colors.dim("\n  Press Ctrl+C again to exit.\n"),
          );
        }
        break;
      }

      case "exiting":
        // Already exiting
        break;
    }
  }
}
