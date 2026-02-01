import { colors, icons } from "./theme.js";

/**
 * Display the orbit-ai startup banner.
 */
export function printBanner(provider: string, model: string): void {
  console.log();
  console.log(
    colors.primary(`  ${icons.orbit} orbit-ai`) +
      colors.dim(" — MongoDB Atlas AI Shell"),
  );
  console.log(
    colors.dim(`  ${provider}/${model}`),
  );
  console.log(colors.dim(`  Type your request in natural language. Ctrl+C to exit.`));
  console.log();
}
