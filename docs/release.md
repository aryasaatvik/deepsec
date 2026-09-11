# Releases

`@aryasaatvik/deepsec` is published from the `dev` branch by the Publish workflow
using [Tegami](https://github.com/fuma-nama/tegami) and npm trusted publishing
(OIDC — no `NPM_TOKEN`).

## Cutting a release

1. Add user-facing notes under `.tegami/` and commit them with the change they
   describe. Frontmatter picks the bump and the first body line is the summary:

   ```md
   ---
   packages:
     "@aryasaatvik/deepsec": minor
   ---

   ## Short summary

   What changed and why it matters.
   ```

2. `GH_TOKEN="$(gh auth token)" pnpm run version:packages` consumes the pending
   entries, bumps `packages/deepsec/package.json`, writes
   `.tegami/publish-lock.yaml`, and opens or updates the
   `tegami/version-packages` PR against `dev`.
3. Merge that PR. The next push to `dev` runs `publish.yml`, which runs
   `release:check` and then `tegami ci`: publish through npm OIDC, push the
   `v<version>` tag, and create the GitHub Release.

`release:validate` packs the package, installs the tarball into a throwaway
prefix, and runs `deepsec --version`; `release:check` runs it after `validate`.

## First publish (bootstrap)

Trusted publishing can only be configured after the package exists, and Actions
must be enabled on the fork:

1. Enable Actions on `aryasaatvik/deepsec` (Actions tab).
2. Publish once from the repo root: `pnpm run release:check`, then from
   `packages/deepsec`: `npm publish --access public`.
3. On npm, add a trusted publisher for `@aryasaatvik/deepsec`: repository
   `aryasaatvik/deepsec`, workflow `publish.yml`, environment blank, no token.
4. Every later release goes through `publish.yml` only.

## Verify

```bash
npm view @aryasaatvik/deepsec version
npm view @aryasaatvik/deepsec dist-tags --json
gh release view "v$(node -p 'require("./packages/deepsec/package.json").version')"
```
