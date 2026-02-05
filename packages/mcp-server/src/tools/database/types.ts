/**
 * Type definitions for database tools.
 *
 * Unlike Atlas Admin API tools (which share a generic ActionMap schema and
 * route through dispatch()), each database tool has its own JSON Schema and
 * executor function. This gives the LLM precise parameter guidance per
 * operation — find needs filter/projection/sort, aggregate needs pipeline, etc.
 */

import type { ConnectionManager } from "./connection.js";

/**
 * Classifies what a database tool does for access control.
 *
 * - "read"       — queries, metadata, exports (always allowed)
 * - "write"      — inserts, creates, updates, deletes (blocked in read-only mode)
 * - "connection" — connect/disconnect (always allowed)
 */
export type DatabaseOperationType = "read" | "write" | "connection";

/**
 * Defines a single MCP database tool backed by the MongoDB Node.js driver.
 *
 * Each tool has a unique inputSchema (unlike ActionMap tools which all share
 * the same { action, params, query, body } shape). The execute function
 * receives a ConnectionManager and the tool's arguments, and returns the
 * result to be serialized as JSON in the MCP response.
 */
export interface DatabaseToolDef {
  /** MCP tool name (e.g., "find", "aggregate", "list-databases"). */
  name: string;

  /** Human-readable description shown to the LLM. */
  description: string;

  /** Access control classification. */
  operationType: DatabaseOperationType;

  /** JSON Schema specific to this tool's parameters. */
  inputSchema: object;

  /** Execute the tool against a live MongoDB connection. */
  execute: (
    conn: ConnectionManager,
    args: Record<string, unknown>,
  ) => Promise<unknown>;
}
