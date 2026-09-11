import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Release gate: assert the publishable package identity, pack it, install the
 * tarball into a throwaway prefix, and run the CLI. Run by `release:check`
 * locally and in `publish.yml` before `tegami ci`.
 */
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pkgDir = path.join(root, "packages/deepsec");
const pkg = JSON.parse(fs.readFileSync(path.join(pkgDir, "package.json"), "utf8")) as {
  name: string;
  version: string;
  bin: Record<string, string>;
  publishConfig?: { access?: string };
};

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`release validation failed: ${message}`);
}

assert(pkg.name === "@aryasaatvik/deepsec", `unexpected package name: ${pkg.name}`);
assert(pkg.bin.deepsec, "missing `deepsec` bin");
assert(pkg.publishConfig?.access === "public", "publishConfig.access must be public");
for (const file of [
  "dist/cli.mjs",
  "dist/config.mjs",
  "dist/config.d.ts",
  "README.md",
  "LICENSE",
  "NOTICE",
  "SKILL.md",
]) {
  assert(fs.existsSync(path.join(pkgDir, file)), `missing packed file: ${file}`);
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "deepsec-release-"));
execFileSync("pnpm", ["pack", "--pack-destination", tmp], { cwd: pkgDir, stdio: "inherit" });
const tarball = fs.readdirSync(tmp).find((entry) => entry.endsWith(".tgz"));
assert(tarball, "pnpm pack produced no tarball");

const prefix = path.join(tmp, "install");
fs.mkdirSync(prefix, { recursive: true });
execFileSync("npm", ["install", "--prefix", prefix, "--ignore-scripts", path.join(tmp, tarball)], {
  stdio: "inherit",
});
const version = execFileSync(path.join(prefix, "node_modules", ".bin", "deepsec"), ["--version"], {
  encoding: "utf8",
}).trim();
assert(
  version.includes(pkg.version),
  `deepsec --version (${version}) != package version ${pkg.version}`,
);

console.log(`Release validation passed for ${pkg.name}@${pkg.version}.`);
