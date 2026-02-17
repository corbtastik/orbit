/**
 * MappingStore — in-memory storage for table-to-collection mappings.
 *
 * Stores migration mappings during a session. Mappings can be created
 * manually or auto-generated from schema analysis recommendations.
 */

import { randomUUID } from "node:crypto";
import type { TableMapping, ColumnMapping, EmbedConfig, ReferenceConfig } from "./types.js";

/**
 * Validation result for a mapping.
 */
export interface ValidationResult {
  valid: boolean;
  checks: ValidationCheck[];
  warnings: string[];
  errors: string[];
}

/**
 * Individual validation check result.
 */
export interface ValidationCheck {
  check: string;
  passed: boolean;
  details?: string;
}

/**
 * In-memory store for table mappings.
 */
export class MappingStore {
  private mappings = new Map<string, TableMapping>();

  /**
   * Create a new mapping.
   *
   * @param mapping The mapping configuration.
   * @returns The mapping ID.
   */
  create(mapping: Omit<TableMapping, "id">): string {
    const id = mapping.sourceTable; // Use table name as ID for easy lookup

    // Check for duplicate
    if (this.mappings.has(id)) {
      throw new Error(
        `Mapping for table "${mapping.sourceTable}" already exists. ` +
        `Use update-mapping to modify it, or delete-mapping first.`
      );
    }

    const fullMapping: TableMapping = {
      ...mapping,
      id,
      validated: false,
    };

    this.mappings.set(id, fullMapping);
    return id;
  }

  /**
   * Get a mapping by ID or table name.
   */
  get(idOrTable: string): TableMapping | undefined {
    return this.mappings.get(idOrTable);
  }

  /**
   * Check if a mapping exists.
   */
  has(idOrTable: string): boolean {
    return this.mappings.has(idOrTable);
  }

  /**
   * List all mappings.
   */
  list(): TableMapping[] {
    return Array.from(this.mappings.values());
  }

  /**
   * Update an existing mapping.
   *
   * @param id Mapping ID or table name.
   * @param updates Partial mapping updates.
   */
  update(id: string, updates: Partial<Omit<TableMapping, "id">>): void {
    const existing = this.mappings.get(id);
    if (!existing) {
      throw new Error(`Mapping "${id}" not found.`);
    }

    // Merge updates, marking as not validated since it changed
    const updated: TableMapping = {
      ...existing,
      ...updates,
      id: existing.id, // Preserve ID
      validated: false,
      validationIssues: undefined,
    };

    this.mappings.set(id, updated);
  }

  /**
   * Add an embed configuration to a mapping.
   */
  addEmbed(id: string, embed: EmbedConfig): void {
    const mapping = this.get(id);
    if (!mapping) {
      throw new Error(`Mapping "${id}" not found.`);
    }

    const embeds = mapping.embeds ?? [];

    // Check for duplicate
    if (embeds.some(e => e.sourceTable === embed.sourceTable)) {
      throw new Error(
        `Embed for table "${embed.sourceTable}" already exists in mapping "${id}".`
      );
    }

    this.update(id, { embeds: [...embeds, embed] });
  }

  /**
   * Remove an embed configuration from a mapping.
   */
  removeEmbed(id: string, sourceTable: string): void {
    const mapping = this.get(id);
    if (!mapping) {
      throw new Error(`Mapping "${id}" not found.`);
    }

    const embeds = mapping.embeds ?? [];
    const filtered = embeds.filter(e => e.sourceTable !== sourceTable);

    if (filtered.length === embeds.length) {
      throw new Error(
        `No embed for table "${sourceTable}" found in mapping "${id}".`
      );
    }

    this.update(id, { embeds: filtered });
  }

  /**
   * Add a reference configuration to a mapping.
   */
  addReference(id: string, reference: ReferenceConfig): void {
    const mapping = this.get(id);
    if (!mapping) {
      throw new Error(`Mapping "${id}" not found.`);
    }

    const references = mapping.references ?? [];

    // Check for duplicate
    if (references.some(r => r.sourceTable === reference.sourceTable)) {
      throw new Error(
        `Reference to table "${reference.sourceTable}" already exists in mapping "${id}".`
      );
    }

    this.update(id, { references: [...references, reference] });
  }

  /**
   * Remove a reference configuration from a mapping.
   */
  removeReference(id: string, sourceTable: string): void {
    const mapping = this.get(id);
    if (!mapping) {
      throw new Error(`Mapping "${id}" not found.`);
    }

    const references = mapping.references ?? [];
    const filtered = references.filter(r => r.sourceTable !== sourceTable);

    if (filtered.length === references.length) {
      throw new Error(
        `No reference to table "${sourceTable}" found in mapping "${id}".`
      );
    }

    this.update(id, { references: filtered });
  }

  /**
   * Add or update a column mapping.
   */
  setColumn(id: string, column: ColumnMapping): void {
    const mapping = this.get(id);
    if (!mapping) {
      throw new Error(`Mapping "${id}" not found.`);
    }

    const columns = mapping.columns ?? [];
    const existingIndex = columns.findIndex(c => c.source === column.source);

    if (existingIndex >= 0) {
      columns[existingIndex] = column;
    } else {
      columns.push(column);
    }

    this.update(id, { columns });
  }

  /**
   * Remove a column mapping (mark as excluded).
   */
  excludeColumn(id: string, sourceColumn: string): void {
    this.setColumn(id, { source: sourceColumn, target: sourceColumn, exclude: true });
  }

  /**
   * Delete a mapping.
   */
  delete(id: string): boolean {
    return this.mappings.delete(id);
  }

  /**
   * Clear all mappings.
   */
  clear(): void {
    this.mappings.clear();
  }

  /**
   * Get the number of mappings.
   */
  get size(): number {
    return this.mappings.size;
  }

  /**
   * Mark a mapping as validated with optional issues.
   */
  setValidationResult(id: string, valid: boolean, issues?: string[]): void {
    const mapping = this.get(id);
    if (!mapping) {
      throw new Error(`Mapping "${id}" not found.`);
    }

    this.mappings.set(id, {
      ...mapping,
      validated: valid,
      validationIssues: issues,
    });
  }

  /**
   * Export a single mapping to JSON string.
   *
   * @param id Mapping ID or table name.
   * @returns JSON string representation.
   */
  export(id: string): string {
    const mapping = this.get(id);
    if (!mapping) {
      throw new Error(`Mapping "${id}" not found.`);
    }
    return JSON.stringify(mapping, null, 2);
  }

  /**
   * Export all mappings to JSON string.
   *
   * @returns JSON string array of all mappings.
   */
  exportAll(): string {
    return JSON.stringify(this.list(), null, 2);
  }

  /**
   * Export all mappings as objects (for internal use).
   */
  exportAllObjects(): TableMapping[] {
    return this.list();
  }

  /**
   * Import mappings from JSON string.
   *
   * Supports both single mapping object and array of mappings.
   *
   * @param json JSON string to import.
   * @param overwrite Whether to overwrite existing mappings. Default: false.
   * @returns Array of imported mapping IDs.
   */
  import(json: string, overwrite = false): string[] {
    const parsed = JSON.parse(json) as TableMapping | TableMapping[];
    const mappings = Array.isArray(parsed) ? parsed : [parsed];
    const imported: string[] = [];

    for (const mapping of mappings) {
      // Validate required fields
      if (!mapping.id || !mapping.sourceTable || !mapping.targetCollection) {
        throw new Error(
          `Invalid mapping: missing required fields (id, sourceTable, targetCollection)`
        );
      }

      if (this.mappings.has(mapping.id) && !overwrite) {
        throw new Error(
          `Mapping "${mapping.id}" already exists. Use overwrite=true to replace.`
        );
      }

      this.mappings.set(mapping.id, mapping);
      imported.push(mapping.id);
    }

    return imported;
  }

  /**
   * Import mappings from objects (for internal use).
   *
   * @param mappings Array of mappings to import.
   * @param overwrite Whether to overwrite existing mappings.
   */
  importAll(mappings: TableMapping[], overwrite = false): void {
    for (const mapping of mappings) {
      if (!this.mappings.has(mapping.id) || overwrite) {
        this.mappings.set(mapping.id, mapping);
      }
    }
  }
}
