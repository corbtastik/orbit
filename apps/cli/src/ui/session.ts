import { colors } from "./theme.js";

export type SessionState = "idle" | "processing" | "aborting" | "exiting";

/**
 * Manages the session lifecycle: abort controllers and the state machine
 * for interrupt handling (Ctrl+C / Escape).
 *
 * Interrupt handling is delegated to the Prompt class (which owns readline).
 * Session only manages state transitions and abort signals.
 */
export class Session {
  private _state: SessionState = "idle";
  private abortController: AbortController | null = null;
  private lastCtrlCTime = 0;
  private write: (text: string) => void;

  constructor(write?: (text: string) => void) {
    this.write = write ?? ((t: string) => { process.stdout.write(t); });
  }

  get state(): SessionState {
    return this._state;
  }

  get shouldExit(): boolean {
    return this._state === "exiting";
  }

  /**
   * Transition to processing state. Creates a fresh AbortController.
   */
  startProcessing(): AbortSignal {
    this._state = "processing";
    this.abortController = new AbortController();
    return this.abortController.signal;
  }

  /**
   * Called when agent turn completes (normally or via abort).
   */
  endProcessing(): void {
    this._state = "idle";
    this.abortController = null;
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
        this.write(colors.dim("\n  Cancelled.\n"));
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
          this.write(colors.dim("\n  Press Ctrl+C again to exit.\n"));
        }
        break;
      }

      case "exiting":
        // Already exiting
        break;
    }
  }
}
