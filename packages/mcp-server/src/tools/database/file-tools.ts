/**
 * File tools — read and write local files.
 *
 * These tools operate on the local filesystem, not MongoDB.
 * They enable workflows like exporting query results to JSON files.
 */

import { writeFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { homedir } from "node:os";
import type { DatabaseToolDef } from "./types.js";

/**
 * Expand ~ to home directory and resolve to absolute path.
 */
function expandPath(path: string): string {
  if (path.startsWith("~/")) {
    return resolve(homedir(), path.slice(2));
  }
  return resolve(path);
}

// ---------------------------------------------------------------------------
// write-json
// ---------------------------------------------------------------------------

const writeJsonTool: DatabaseToolDef = {
  name: "write-json",
  description:
    "Write documents to a local JSON file. " +
    "Accepts an array of documents and writes them as a formatted JSON array. " +
    "Supports ~ for home directory. Creates parent directories if needed.",
  operationType: "write",
  inputSchema: {
    type: "object",
    properties: {
      path: {
        type: "string",
        description:
          "File path to write. Supports ~ for home directory. " +
          'Example: "~/data/export.json" or "/tmp/results.json"',
      },
      documents: {
        type: "array",
        description: "Array of documents to write as JSON.",
        items: { type: "object" },
      },
      pretty: {
        type: "boolean",
        description: "Pretty-print JSON with 2-space indentation (default: true).",
      },
    },
    required: ["path", "documents"],
  },
  execute: async (_conn, args) => {
    const filePath = expandPath(args.path as string);
    const documents = args.documents as unknown[];
    const pretty = args.pretty !== false;

    // Ensure parent directory exists
    const dir = dirname(filePath);
    await mkdir(dir, { recursive: true });

    // Write JSON
    const content = pretty
      ? JSON.stringify(documents, null, 2)
      : JSON.stringify(documents);

    await writeFile(filePath, content, "utf-8");

    return {
      ok: true,
      path: filePath,
      documentCount: documents.length,
      bytes: Buffer.byteLength(content, "utf-8"),
      message: `Wrote ${documents.length} documents to ${filePath}`,
    };
  },
};

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

export const FILE_TOOLS: DatabaseToolDef[] = [
  writeJsonTool,
];
