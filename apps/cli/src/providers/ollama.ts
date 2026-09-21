import { OpenAiProvider } from "./openai.js";

/**
 * Ollama provider for local LLM inference.
 *
 * Ollama exposes an OpenAI-compatible API at localhost:11434/v1,
 * so this provider extends OpenAiProvider with Ollama-specific defaults.
 *
 * Requires Ollama running locally: https://ollama.ai
 */
export class OllamaProvider extends OpenAiProvider {
  constructor(model: string, baseUrl?: string) {
    super({
      apiKey: "ollama", // Ollama doesn't require an API key
      model,
      baseUrl: baseUrl ?? "http://localhost:11434/v1",
      name: "ollama",
    });
  }
}
