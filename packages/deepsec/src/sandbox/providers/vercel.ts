import { Sandbox } from "@vercel/sandbox";
import type { SandboxCreateOptions, SandboxHandle, SandboxProvider } from "../provider.js";

/**
 * Adapter over @vercel/sandbox. The SDK's `Sandbox` already implements the
 * handle surface; the casts keep the vendor types out of the sandbox core so
 * other providers can be dropped in.
 */
export const vercelSandboxProvider: SandboxProvider = {
  kind: "vercel",
  async create(options: SandboxCreateOptions): Promise<SandboxHandle> {
    return (await Sandbox.create(options as never)) as unknown as SandboxHandle;
  },
  async get(id: string): Promise<SandboxHandle> {
    return (await Sandbox.get({ sandboxId: id })) as unknown as SandboxHandle;
  },
};
