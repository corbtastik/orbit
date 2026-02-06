/**
 * CLI-specific defaults and constants.
 *
 * Core configuration is now in @orbit/core. This file contains
 * CLI-specific constants like VERSION.
 */

// Re-export from core for convenience
export {
  CONFIG_DIR,
  CONFIG_FILE,
  ENV,
  DEFAULTS,
} from "@orbit/core";

/** Application version (0.x.y = in development, pre-stable). */
export const VERSION = "0.1.0";
