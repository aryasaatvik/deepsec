import { createInterface } from "node:readline/promises";
import {
  CODEX_LOCAL_ROUTE,
  type ModelRoute,
  OPENAI_CODEX_ROUTE,
  OPENCODE_GO_ROUTE,
} from "./model-route.js";

export interface InteractiveModelChoice {
  route: ModelRoute;
  defaultAgent?: "codex" | "claude" | "pi";
}

export async function promptForModelRoute(): Promise<InteractiveModelChoice> {
  const prompt = createInterface({ input: process.stdin, output: process.stdout });
  try {
    console.log("\nChoose how Deepsec should access an AI model:");
    console.log("  1. Codex, using the machine-wide codex login (recommended)");
    console.log("  2. Pi, through OpenCode Go (OPENCODE_API_KEY)");
    console.log("  3. Pi, through an OpenAI Codex subscription login");
    console.log("  4. Vercel AI Gateway using the linked project's identity");
    console.log("  5. My OpenAI API key");
    console.log("  6. My Anthropic API key");
    const answer = (await prompt.question("\nModel access [1]: ")).trim() || "1";
    if (answer === "1") return { route: { ...CODEX_LOCAL_ROUTE }, defaultAgent: "codex" };
    if (answer === "2") return { route: { ...OPENCODE_GO_ROUTE }, defaultAgent: "pi" };
    if (answer === "3") return { route: { ...OPENAI_CODEX_ROUTE }, defaultAgent: "pi" };
    if (answer === "4") return { route: { mode: "gateway", provider: "vercel" } };
    if (answer !== "5" && answer !== "6") throw new Error("Invalid model access selection");
    const openai = answer === "5";
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
