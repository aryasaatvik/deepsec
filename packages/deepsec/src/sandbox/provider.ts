import type { SandboxLogChunk } from "./provider-types.js";

export type { SandboxLogChunk };

/**
 * The sandbox execution boundary. Providers implement this interface so the
 * orchestrator never imports a vendor SDK directly; Vercel is one adapter and
 * local/other providers can be added without touching the sandbox call sites.
 */

export interface SandboxCommand {
  readonly cmdId: string;
  readonly exitCode: number | null;
  stdout(options?: { signal?: AbortSignal }): Promise<string>;
  stderr(options?: { signal?: AbortSignal }): Promise<string>;
  wait(options?: { signal?: AbortSignal }): Promise<SandboxFinishedCommand>;
  logs(options?: { signal?: AbortSignal }): AsyncIterable<SandboxLogChunk>;
}

export interface SandboxFinishedCommand extends SandboxCommand {
  readonly exitCode: number;
}

export interface SandboxFile {
  path: string;
  content: string | Uint8Array;
}

export interface SandboxHandle {
  readonly sandboxId: string;
  runCommand(input: SandboxRunCommandInput): Promise<SandboxCommand>;
  getCommand(cmdId: string): Promise<SandboxCommand>;
  writeFiles(files: SandboxFile[]): Promise<void>;
  downloadFile(
    src: { path: string },
    dest?: { path: string },
    options?: { mkdirRecursive?: boolean },
  ): Promise<{ path: string }>;
  snapshot(options?: { expiration?: number }): Promise<{ snapshotId: string }>;
  stop(): Promise<void>;
}

export interface SandboxRunCommandInput {
  cmd: string;
  args?: string[];
  env?: Record<string, string>;
  cwd?: string;
  sudo?: boolean;
  [key: string]: unknown;
}

export interface SandboxCreateOptions {
  /** Provider-specific runtime/image selector (Vercel: "node24"). */
  runtime?: string;
  env?: Record<string, string>;
  resources?: { vcpus?: number };
  timeout?: number;
  /** Opaque to the core; each provider interprets or ignores it. */
  networkPolicy?: unknown;
  source?: { type: "snapshot"; snapshotId: string };
  [key: string]: unknown;
}

export type SandboxProviderKind = "vercel" | "local";

export interface SandboxProvider {
  readonly kind: SandboxProviderKind;
  create(options: SandboxCreateOptions): Promise<SandboxHandle>;
  get(id: string): Promise<SandboxHandle>;
}

/** Resolve a provider lazily so only the selected vendor SDK is loaded. */
export async function createSandboxProvider(
  kind: SandboxProviderKind = "vercel",
): Promise<SandboxProvider> {
  if (kind === "local") {
    const { localSandboxProvider } = await import("./providers/local.js");
    return localSandboxProvider;
  }
  const { vercelSandboxProvider } = await import("./providers/vercel.js");
  return vercelSandboxProvider;
}
