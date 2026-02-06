/**
 * CLI configuration exports.
 */

export { VERSION } from "./defaults.js";

// Re-export shared config from @orbit/core
export {
  CONFIG_DIR,
  CONFIG_FILE,
  ENV,
  DEFAULTS,
} from "@orbit/core";

export {
  resolveCliConfig,
  getRawConfig,
} from "./config.js";

export type {
  CliConfig,
  CliFlags,
  LlmProviderName,
  OutputFormat,
} from "./config.js";
