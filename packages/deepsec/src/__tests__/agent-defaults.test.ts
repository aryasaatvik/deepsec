import { defineConfig, setLoadedConfig } from "@deepsec/core";
import { afterEach, describe, expect, it } from "vitest";
import { defaultModelForAgent } from "../agent-defaults.js";

describe("defaultModelForAgent", () => {
  afterEach(() => setLoadedConfig(defineConfig({ projects: [] })));

  it("returns the backend-specific default models", () => {
    expect(defaultModelForAgent("codex")).toBe("daybreak-blue-latest");
    expect(defaultModelForAgent("pi")).toBe("opencode-go/deepseek-v4.1-flash");
    expect(defaultModelForAgent("claude-agent-sdk")).toBe("claude-opus-4-8");
  });

  it("uses the model persisted for the configured harness", () => {
    setLoadedConfig(
      defineConfig({ projects: [], defaultAgent: "pi", defaultModel: "xai/grok-4.5" }),
    );
    expect(defaultModelForAgent("pi")).toBe("xai/grok-4.5");
    expect(defaultModelForAgent("codex")).toBe("daybreak-blue-latest");
  });
});
