import { type ChildProcess, spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type {
  SandboxCommand,
  SandboxCreateOptions,
  SandboxFile,
  SandboxFinishedCommand,
  SandboxHandle,
  SandboxLogChunk,
  SandboxProvider,
  SandboxRunCommandInput,
} from "../provider.js";

/**
 * Reference non-Vercel provider: runs commands as host child processes in a
 * per-sandbox temp directory. No vCPU budget, network policy, or snapshots —
 * those options are ignored. Intended for local runs and as the template other
 * providers (Modal, Daytona, Docker) follow.
 */
class LocalCommand implements SandboxCommand {
  readonly cmdId: string;
  exitCode: number | null = null;

  private stdoutText = "";
  private stderrText = "";
  private readonly chunks: SandboxLogChunk[] = [];
  private wake: (() => void) | undefined;
  private readonly exited: Promise<{ exitCode: number }>;
  private resolveExit!: (value: { exitCode: number }) => void;

  constructor(child: ChildProcess) {
    this.cmdId = `local-${child.pid ?? 0}`;
    this.exited = new Promise((resolve) => {
      this.resolveExit = resolve;
    });
    child.stdout?.on("data", (data: Buffer) => {
      const text = data.toString();
      this.stdoutText += text;
      this.push({ stream: "stdout", data: text });
    });
    child.stderr?.on("data", (data: Buffer) => {
      const text = data.toString();
      this.stderrText += text;
      this.push({ stream: "stderr", data: text });
    });
    child.on("exit", (code) => this.finish(code ?? -1));
    child.on("error", (error) => {
      this.stderrText += String(error);
      this.push({ stream: "stderr", data: String(error) });
      this.finish(-1);
    });
  }

  private push(chunk: SandboxLogChunk): void {
    this.chunks.push(chunk);
    this.wake?.();
    this.wake = undefined;
  }

  private finish(code: number): void {
    this.exitCode = code;
    this.resolveExit({ exitCode: code });
    this.wake?.();
    this.wake = undefined;
  }

  async stdout(): Promise<string> {
    return this.stdoutText;
  }

  async stderr(): Promise<string> {
    return this.stderrText;
  }

  async wait(): Promise<SandboxFinishedCommand> {
    await this.exited;
    return this as unknown as SandboxFinishedCommand;
  }

  async *logs(options?: { signal?: AbortSignal }): AsyncIterable<SandboxLogChunk> {
    let index = 0;
    for (;;) {
      options?.signal?.throwIfAborted();
      while (index < this.chunks.length) yield this.chunks[index++];
      if (this.exitCode !== null) return;
      await new Promise<void>((resolve) => {
        this.wake = resolve;
        options?.signal?.addEventListener("abort", () => resolve(), { once: true });
      });
    }
  }
}

class LocalSandboxHandle implements SandboxHandle {
  readonly sandboxId: string;
  private readonly children = new Set<ChildProcess>();

  constructor(private readonly root: string) {
    this.sandboxId = `local-${path.basename(root)}`;
  }

  private hostPath(remote: string): string {
    return path.join(this.root, remote.replace(/^\/+/, ""));
  }

  async runCommand(input: SandboxRunCommandInput): Promise<SandboxCommand> {
    const child = spawn(input.cmd, input.args ?? [], {
      cwd: input.cwd ? this.hostPath(input.cwd) : this.root,
      env: { ...process.env, ...(input.env ?? {}) },
      stdio: ["ignore", "pipe", "pipe"],
    });
    this.children.add(child);
    child.on("exit", () => this.children.delete(child));
    const command = new LocalCommand(child);
    // Match Vercel's non-detached runCommand, which resolves after the process
    // exits; callers inspect exitCode immediately on the resolved command.
    await command.wait();
    return command;
  }

  async getCommand(): Promise<SandboxCommand> {
    throw new Error("The local sandbox provider cannot reattach to a completed command");
  }

  async writeFiles(files: SandboxFile[]): Promise<void> {
    for (const file of files) {
      const target = this.hostPath(file.path);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, file.content);
    }
  }

  async downloadFile(
    src: { path: string },
    dest?: { path: string },
    options?: { mkdirRecursive?: boolean },
  ): Promise<{ path: string }> {
    const bytes = fs.readFileSync(this.hostPath(src.path));
    if (!dest) return { path: src.path };
    if (options?.mkdirRecursive) fs.mkdirSync(path.dirname(dest.path), { recursive: true });
    fs.writeFileSync(dest.path, bytes);
    return { path: dest.path };
  }

  async snapshot(): Promise<{ snapshotId: string }> {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "deepsec-local-snapshot-"));
    fs.cpSync(this.root, dir, { recursive: true });
    return { snapshotId: dir };
  }

  async stop(): Promise<void> {
    for (const child of this.children) child.kill("SIGKILL");
    this.children.clear();
  }
}

export const localSandboxProvider: SandboxProvider = {
  kind: "local",
  async create(options: SandboxCreateOptions): Promise<SandboxHandle> {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "deepsec-local-sandbox-"));
    if (options.source?.type === "snapshot") {
      fs.cpSync(options.source.snapshotId, root, { recursive: true });
    }
    return new LocalSandboxHandle(root);
  },
  async get(): Promise<SandboxHandle> {
    throw new Error("The local sandbox provider cannot reattach to a sandbox by id");
  },
};
