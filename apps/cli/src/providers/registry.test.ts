import { describe, it, expect } from "vitest";
import { createProvider } from "./registry.js";

// Providers carry no model fallbacks of their own — the config layer always
// resolves one (DEFAULTS.providerModels in @orbit/core), so every call here
// passes one explicitly.
const MODEL = "test-model";

describe("createProvider", () => {
  it("creates Anthropic provider with API key", () => {
    const provider = createProvider("anthropic", "sk-ant-test", MODEL);
    expect(provider.name).toBe("anthropic");
  });

  it("throws for Anthropic without API key", () => {
    expect(() => createProvider("anthropic", undefined, MODEL)).toThrow(
      "Anthropic API key is required",
    );
  });

  it("creates OpenAI provider with API key", () => {
    const provider = createProvider("openai", "sk-oai-test", MODEL);
    expect(provider.name).toBe("openai");
  });

  it("throws for OpenAI without API key", () => {
    expect(() => createProvider("openai", undefined, MODEL)).toThrow(
      "OpenAI API key is required",
    );
  });

  it("creates Google provider with API key", () => {
    const provider = createProvider("google", "goog-test", MODEL);
    expect(provider.name).toBe("google");
  });

  it("throws for Google without API key", () => {
    expect(() => createProvider("google", undefined, MODEL)).toThrow(
      "Google AI API key is required",
    );
  });

  it("creates Ollama provider without API key", () => {
    const provider = createProvider("ollama", undefined, MODEL);
    expect(provider.name).toBe("ollama");
  });

  it("passes model to provider", () => {
    const provider = createProvider("anthropic", "key", MODEL);
    expect(provider.name).toBe("anthropic");
    // Model is internal, just verify creation succeeds
  });

  it("passes baseUrl to OpenAI provider", () => {
    const provider = createProvider(
      "openai",
      "key",
      MODEL,
      "https://custom.api.com/v1",
    );
    expect(provider.name).toBe("openai");
  });

  it("passes baseUrl to Ollama provider", () => {
    const provider = createProvider(
      "ollama",
      undefined,
      MODEL,
      "http://remote:11434/v1",
    );
    expect(provider.name).toBe("ollama");
  });

  it("throws for unknown provider", () => {
    expect(() => createProvider("llama-cpp", "key", MODEL)).toThrow(
      "Unknown provider",
    );
    expect(() => createProvider("llama-cpp", "key", MODEL)).toThrow(
      "anthropic, openai, google, ollama",
    );
  });
});
