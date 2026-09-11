import { describe, expect, it, vi } from "vitest";
import { ensureConnectedWorkspace } from "../auth/ensure-connected-workspace.js";
import type { ModelRoute, ResolvedModelRoute } from "../auth/model-route.js";

const directRoute = { mode: "direct", provider: "openai", apiKeyEnv: "OPENAI_API_KEY" } as const;
const gatewayRoute = { mode: "gateway", provider: "vercel" } as const;

function resolved(route: ModelRoute = directRoute): ResolvedModelRoute {
  return {
    route,
    credentialEnv: "OPENAI_API_KEY",
    credential: "secret",
    environment: { OPENAI_API_KEY: "secret" },
    broker: {
      host: "api.openai.com",
      placeholderEnv: "OPENAI_API_KEY",
      header: { name: "authorization", value: "Bearer secret" },
    },
  };
}

describe("ensureConnectedWorkspace", () => {
  it("resolves and verifies a non-gateway route without linking the platform", async () => {
    const verifyModelRoute = vi.fn(async () => undefined);
    const resolveRoute = vi.fn(async () => resolved());
    const ensureLink = vi.fn();
    const result = await ensureConnectedWorkspace({
      workspaceDir: "/workspace",
      interactive: false,
      modelRoute: directRoute,
      agentTypes: ["codex"],
      env: { OPENAI_API_KEY: "secret" },
      dependencies: {
        ensureLink,
        resolveRoute,
        verifyModelRoute,
        now: () => new Date("2026-01-01T00:00:00Z"),
      },
    });
    expect(ensureLink).not.toHaveBeenCalled();
    expect(resolveRoute).toHaveBeenCalledOnce();
    expect(verifyModelRoute).toHaveBeenCalledOnce();
    expect(result.project).toBeUndefined();
    expect(result.platformAuth).toBeUndefined();
    expect(result.sandboxReady).toBe(false);
    expect(result.modelRouteVerified).toBe(true);
  });

  it("short-circuits fresh matching verification for a non-gateway route", async () => {
    const verifyModelRoute = vi.fn(async () => undefined);
    const resolveRoute = vi.fn(async () => resolved());
    const previous = {
      route: directRoute,
      agentTypes: ["codex"],
      modelVerifiedAt: "2026-01-01T00:00:00Z",
    };
    const result = await ensureConnectedWorkspace({
      workspaceDir: "/workspace",
      interactive: false,
      modelRoute: directRoute,
      agentTypes: ["codex"],
      env: { OPENAI_API_KEY: "secret" },
      previous,
      dependencies: {
        resolveRoute,
        verifyModelRoute,
        now: () => new Date("2026-01-01T01:00:00Z"),
      },
    });
    expect(resolveRoute).toHaveBeenCalledOnce();
    expect(verifyModelRoute).not.toHaveBeenCalled();
    expect(result.sandboxReady).toBe(false);
  });

  it("links the platform and returns a sandbox-ready checkpoint for a gateway route", async () => {
    const verifyModelRoute = vi.fn(async () => undefined);
    const resolveRoute = vi.fn(async () => resolved(gatewayRoute));
    const ensureLink = vi.fn(async () => ({
      method: "access-token-triple" as const,
      project: { teamId: "team", projectId: "project" },
      link: { orgId: "team", projectId: "project" },
    }));
    const result = await ensureConnectedWorkspace({
      workspaceDir: "/workspace",
      interactive: false,
      modelRoute: gatewayRoute,
      agentTypes: ["codex"],
      env: { VERCEL_TOKEN: "v", VERCEL_TEAM_ID: "team", VERCEL_PROJECT_ID: "project" },
      dependencies: {
        ensureLink,
        resolveRoute,
        verifyModelRoute,
        now: () => new Date("2026-01-01T00:00:00Z"),
      },
    });
    expect(ensureLink).toHaveBeenCalledOnce();
    expect(result.project).toEqual({ teamId: "team", projectId: "project" });
    expect(result.platformAuth).toEqual({ method: "access-token-triple" });
    expect(result.sandboxReady).toBe(true);
    expect(result.modelRouteVerified).toBe(true);
  });

  it("skips the platform link, credential resolution and verification for a local route", async () => {
    const resolveRoute = vi.fn(async () => resolved());
    const verifyModelRoute = vi.fn(async () => undefined);
    const ensureLink = vi.fn(async () => ({
      method: "access-token-triple" as const,
      project: { teamId: "team", projectId: "project" },
      link: { orgId: "team", projectId: "project" },
    }));
    const localRoute = { mode: "local", provider: "local" } as const;
    const env = { VERCEL_TOKEN: "v", VERCEL_TEAM_ID: "team", VERCEL_PROJECT_ID: "project" };
    const result = await ensureConnectedWorkspace({
      workspaceDir: "/workspace",
      interactive: false,
      modelRoute: localRoute,
      agentTypes: ["claude-agent-sdk"],
      env,
      dependencies: {
        ensureLink,
        resolveRoute,
        verifyModelRoute,
        now: () => new Date("2026-01-01T00:00:00Z"),
      },
    });
    expect(ensureLink).not.toHaveBeenCalled();
    expect(result.project).toBeUndefined();
    expect(resolveRoute).not.toHaveBeenCalled();
    expect(verifyModelRoute).not.toHaveBeenCalled();
    expect(result.modelAuth).toEqual(localRoute);
    expect(result.modelRouteVerified).toBe(false);
    expect(result.verification.route).toEqual(localRoute);
    // No model credential env vars were injected.
    expect(env).toEqual({
      VERCEL_TOKEN: "v",
      VERCEL_TEAM_ID: "team",
      VERCEL_PROJECT_ID: "project",
    });
  });
});
