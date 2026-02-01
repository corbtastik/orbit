import type { LlmProvider } from "./types.js";
import { AnthropicProvider } from "./anthropic.js";
import { OpenAiProvider } from "./openai.js";
import { GoogleProvider } from "./google.js";
import { OllamaProvider } from "./ollama.js";

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
    case "openai": {
      if (!apiKey) {
        throw new Error(
          "OpenAI API key is required. Set OPENAI_API_KEY or configure in ~/.orbit-ai/config.json",
        );
      }
      return new OpenAiProvider({ apiKey, model, baseUrl });
    }
    case "google": {
      if (!apiKey) {
        throw new Error(
          "Google AI API key is required. Set GOOGLE_API_KEY or configure in ~/.orbit-ai/config.json",
        );
      }
      return new GoogleProvider(apiKey, model);
    }
    case "ollama": {
      return new OllamaProvider(model, baseUrl);
    }
    default:
      throw new Error(
        `Unknown provider: ${provider}. Supported: anthropic, openai, google, ollama`,
      );
  }
}
