/**
 * Migration module — barrel export.
 */

export { MigrationExecutor } from "./executor.js";
export { DocumentTransformer } from "./transformer.js";

export type {
  MigrationOptions,
  MigrationProgress,
  MigrationResult,
  MigrationError,
  MigrationEstimate,
  EmbedEstimate,
  VerificationResult,
  SampleComparison,
  BatchMigrationResult,
} from "./types.js";
