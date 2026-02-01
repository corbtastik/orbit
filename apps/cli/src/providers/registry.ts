import type { LlmProvider } from "./types.js";
import { AnthropicProvider } from "./anthropic.js";

/**
 * Create an LLM provider instance by name.
 */
export function createProvider(
  provider: string,
  apiKey: string | undefined,
  model?: string,
  baseUrl?: string,
): LlmProvider {
  switch (provider) {
    case "anthropic": {
      if (!apiKey) {
        throw new Error(
          "Anthropic API key is required. Set ANTHROPIC_API_KEY or configure in ~/.orbit-ai/config.json",
        );
      }
      return new AnthropicProvider(apiKey, model);
    }
    case "openai":
      throw new Error(
        "OpenAI provider is not yet implemented. Use --provider anthropic for now.",
      );
    case "google":
      throw new Error(
        "Google AI provider is not yet implemented. Use --provider anthropic for now.",
      );
    case "ollama":
      throw new Error(
        "Ollama provider is not yet implemented. Use --provider anthropic for now.",
      );
    default:
      throw new Error(
        `Unknown provider: ${provider}. Supported: anthropic, openai, google, ollama`,
      );
  }
}
