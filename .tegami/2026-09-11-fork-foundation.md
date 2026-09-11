---
packages:
  "@aryasaatvik/deepsec": minor
---

## Fork of deepsec: Codex Daybreak default, Pi second, pluggable sandboxes

`@aryasaatvik/deepsec` is a fork of `vercel-labs/deepsec` tuned for this
workspace:

- Codex is the default harness with `daybreak-blue-latest`; Pi is the second
  recommended harness, with OpenCode Go and OpenAI Codex subscription presets.
- Sandbox execution is provider-pluggable: a `SandboxProvider` interface with a
  Vercel adapter and a local reference adapter, selected with
  `--sandbox-provider`.
- The fork builds and publishes with pnpm 12; `packages/website` is kept in-tree
  but excluded from the workspace.
