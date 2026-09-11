import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { createSandboxProvider } from "../sandbox/provider.js";

describe("createSandboxProvider", () => {
  it("resolves the requested provider kind and defaults to Vercel", async () => {
    expect((await createSandboxProvider("vercel")).kind).toBe("vercel");
    expect((await createSandboxProvider("local")).kind).toBe("local");
    expect((await createSandboxProvider()).kind).toBe("vercel");
  });

  it("rejects an unsupported provider instead of defaulting to Vercel", async () => {
    await expect(createSandboxProvider("locl" as never)).rejects.toThrow(
      /Unsupported sandbox provider/,
    );
  });

  it("runs commands and moves files through the local reference provider", async () => {
    const provider = await createSandboxProvider("local");
    const sandbox = await provider.create({});
    await sandbox.writeFiles([{ path: "notes/hello.txt", content: "hi" }]);

    const command = await sandbox.runCommand({ cmd: "cat", args: ["notes/hello.txt"] });
    const output: string[] = [];
    for await (const chunk of command.logs()) output.push(chunk.data);
    const finished = await command.wait();
    expect(finished.exitCode).toBe(0);
    expect(await command.stdout()).toContain("hi");
    expect(output.join("")).toContain("hi");

    const dest = path.join(os.tmpdir(), `deepsec-local-download-${Date.now()}.txt`);
    await sandbox.downloadFile(
      { path: "notes/hello.txt" },
      { path: dest },
      { mkdirRecursive: true },
    );
    expect(fs.readFileSync(dest, "utf8")).toBe("hi");
    fs.rmSync(dest, { force: true });
    await sandbox.stop();
  });

  it("snapshots and rejects operations the local provider cannot support", async () => {
    const provider = await createSandboxProvider("local");
    const sandbox = await provider.create({});
    await expect(sandbox.snapshot()).resolves.toMatchObject({
      snapshotId: expect.any(String),
    });
    await expect(provider.get("nope")).rejects.toThrow(/reattach/);
    await sandbox.stop();
  });
});
