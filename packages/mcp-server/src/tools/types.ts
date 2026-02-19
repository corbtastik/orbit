/**
 * Shared type definitions for all MCP tools.
 *
 * Provides base interfaces that database and RDBMS tools extend.
 */

/**
 * Base interface for all tool definitions.
 *
 * Contains common fields shared by DatabaseToolDef and RdbmsToolDef.
 * Each tool type extends this with its specific operationType and execute signature.
 */
export interface BaseToolDef {
  /** MCP tool name (e.g., "find", "introspect-schema"). */
  name: string;

  /** Human-readable description shown to the LLM. */
  description: string;

  /** JSON Schema for tool parameters. */
  inputSchema: object;
}
