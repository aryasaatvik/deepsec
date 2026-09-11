import { createInterface } from "node:readline/promises";
import { type ModelRoute, OPENAI_CODEX_ROUTE, OPENCODE_GO_ROUTE } from "./model-route.js";

export interface InteractiveModelChoice {
  route: ModelRoute;
  defaultAgent?: "codex" | "claude" | "pi";
}

export async function promptForModelRoute(): Promise<InteractiveModelChoice> {
  const prompt = createInterface({ input: process.stdin, output: process.stdout });
  try {
    console.log("\nChoose how Deepsec should access an AI model:");
    console.log("  1. OpenCode Go, via OPENCODE_API_KEY (Pi, recommended)");
    console.log("  2. OpenAI Codex subscription, via the machine-wide pi login (Pi)");
    console.log("  3. Vercel AI Gateway using the linked project's identity");
    console.log("  4. My OpenAI API key (Codex)");
    console.log("  5. My Anthropic API key (Claude)");
    console.log("  6. Other local subscriptions (claude/codex already logged in)");
    const answer = (await prompt.question("\nModel access [1]: ")).trim() || "1";
    if (answer === "1") return { route: { ...OPENCODE_GO_ROUTE }, defaultAgent: "pi" };
    if (answer === "2") return { route: { ...OPENAI_CODEX_ROUTE }, defaultAgent: "pi" };
    if (answer === "3") return { route: { mode: "gateway", provider: "vercel" } };
    if (answer === "6") return { route: { mode: "local", provider: "local" } };
    if (answer !== "4" && answer !== "5") throw new Error("Invalid model access selection");
    const openai = answer === "4";
    const defaultEnv = openai ? "OPENAI_API_KEY" : "ANTHROPIC_API_KEY";
    const envAnswer = await prompt.question(`Credential environment variable [${defaultEnv}]: `);
    const apiKeyEnv = envAnswer.trim() || defaultEnv;
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(apiKeyEnv)) {
      throw new Error("Credential environment variable must be a valid environment-variable name");
    }
    return {
      route: {
        mode: "direct",
        provider: openai ? "openai" : "anthropic",
        apiKeyEnv,
      },
      defaultAgent: openai ? "codex" : "claude",
    };
  } finally {
    prompt.close();
  }
}
