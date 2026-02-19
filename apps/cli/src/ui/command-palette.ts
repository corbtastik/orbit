import { colors, icons } from "./theme.js";
import { cursorTo, cursorSave, cursorRestore, eraseLine, stripAnsi } from "./ansi.js";

/** A command that can appear in the palette. */
export interface PaletteCommand {
  name: string;
  description: string;
}

/**
 * Visual command palette that renders a filtered list of slash commands
 * above the prompt separator. Activates when the user types "/" and
 * filters as they continue typing.
 *
 * Works with ScreenManager to position the palette above the separator.
 */
export class CommandPalette {
  private commands: PaletteCommand[];
  private filtered: PaletteCommand[] = [];
  private _visible = false;
  private selectedIndex = 0;
  private renderedRows = 0;
  private separatorRow: () => number;
  private cols: () => number;

  /**
   * @param commands - The available slash commands.
   * @param separatorRow - Callback returning the current separator row number.
   * @param cols - Callback returning the current terminal column count.
   */
  constructor(
    commands: PaletteCommand[],
    separatorRow: () => number,
    cols: () => number,
  ) {
    this.commands = commands;
    this.separatorRow = separatorRow;
    this.cols = cols;
  }

  get isVisible(): boolean {
    return this._visible;
  }

  /** Get the currently highlighted command name (e.g., "/help"). */
  getSelected(): string | null {
    if (!this._visible || this.filtered.length === 0) return null;
    return this.filtered[this.selectedIndex].name;
  }

  /** Get the filtered commands list for readline completer. */
  getCompletions(filter: string): string[] {
    return this.filterCommands(filter).map((c) => c.name);
  }

  /** Move selection up. */
  moveUp(): void {
    if (this.filtered.length === 0) return;
    this.selectedIndex =
      (this.selectedIndex - 1 + this.filtered.length) % this.filtered.length;
    this.render();
  }

  /** Move selection down. */
  moveDown(): void {
    if (this.filtered.length === 0) return;
    this.selectedIndex = (this.selectedIndex + 1) % this.filtered.length;
    this.render();
  }

  /**
   * Update the palette filter and re-render.
   * @param input - The current input line (e.g., "/cl").
   */
  update(input: string): void {
    const filter = input.startsWith("/") ? input : "";
    this.filtered = this.filterCommands(filter);
    this.selectedIndex = 0;
    this._visible = this.filtered.length > 0 && filter.length > 0;

    if (this._visible) {
      this.render();
    } else {
      this.clear();
    }
  }

  /** Hide and clear the palette. */
  hide(): void {
    if (this._visible) {
      this.clear();
    }
    this._visible = false;
    this.selectedIndex = 0;
  }

  // ── Private ──────────────────────────────────────────────────────

  private filterCommands(filter: string): PaletteCommand[] {
    if (!filter || filter === "/") return this.commands;
    const lower = filter.toLowerCase();
    return this.commands.filter((c) => c.name.toLowerCase().startsWith(lower));
  }

  private render(): void {
    const sepRow = this.separatorRow();
    const width = this.cols();
    const items = this.filtered;

    // Clear any previously rendered rows
    this.clearRenderedRows();

    // Render items above the separator row (bottom-up)
    this.renderedRows = items.length;
    process.stdout.write(cursorSave);

    for (let i = 0; i < items.length; i++) {
      const row = sepRow - items.length + i;
      if (row < 1) continue; // don't render above the top of the screen

      const cmd = items[i];
      const isSelected = i === this.selectedIndex;
      const prefix = isSelected ? `${icons.arrow} ` : "  ";

      const nameStr = isSelected
        ? colors.primary(cmd.name)
        : colors.text(cmd.name);
      const descStr = colors.dim(cmd.description);
      const line = `${prefix}${nameStr}  ${descStr}`;

      // Render with background highlight for selected item
      process.stdout.write(cursorTo(row, 1));
      process.stdout.write(eraseLine);
      if (isSelected) {
        process.stdout.write(colors.dim("\x1b[48;5;236m")); // subtle dark bg
      }
      process.stdout.write(` ${line}`);
      if (isSelected) {
        // Fill rest of line with bg color, then reset
        const plainLen = stripAnsi(` ${line}`).length;
        const pad = Math.max(0, width - plainLen);
        process.stdout.write(" ".repeat(pad));
        process.stdout.write("\x1b[0m");
      }
    }

    process.stdout.write(cursorRestore);
  }

  private clear(): void {
    if (this.renderedRows === 0) return;

    const sepRow = this.separatorRow();
    process.stdout.write(cursorSave);

    for (let i = 0; i < this.renderedRows; i++) {
      const row = sepRow - this.renderedRows + i;
      if (row < 1) continue;
      process.stdout.write(cursorTo(row, 1));
      process.stdout.write(eraseLine);
    }

    process.stdout.write(cursorRestore);
    this.renderedRows = 0;
  }

  private clearRenderedRows(): void {
    this.clear();
  }
}
