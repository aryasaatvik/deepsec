import { tegami, type TegamiPlugin } from "tegami";
import { runCli } from "tegami/cli";
import { github } from "tegami/plugins/github";

import rootPackage from "../package.json" with { type: "json" };

const REPOSITORY = "aryasaatvik/deepsec";
const PACKAGE_ID = "npm:@aryasaatvik/deepsec";

const deepsecTag = (): TegamiPlugin => ({
  name: "deepsec-tag",
  enforce: "post",
  initPublishPlan({ plan }) {
    const pkg = this.graph.get(PACKAGE_ID);
    const packagePlan = plan.packages.get(PACKAGE_ID);
    if (!pkg?.version || !packagePlan) return;

    packagePlan.git ??= {};
    packagePlan.git.tag = `v${pkg.version}`;
  },
});

if (rootPackage.name !== "deepsec-monorepo") throw new Error("unexpected release package");

const paper = tegami({
  ignore: ["@deepsec/*"],
  npm: {
    client: "pnpm",
    trustedPublish: {
      provider: "github",
      workflow: "publish.yml",
    },
  },
  packages: {
    "@aryasaatvik/deepsec": {},
  },
  plugins: [
    github({
      repo: REPOSITORY,
      pushTags: true,
      versionPr: {
        branch: "tegami/version-packages",
        base: "dev",
        forceCreate: true,
        create() {
          const version = this.graph.get(PACKAGE_ID)?.version;
          return {
            title: version
              ? `chore(release): prepare deepsec ${version}`
              : "chore(release): prepare deepsec",
          };
        },
      },
      release: {
        create({ tag }) {
          return { title: tag };
        },
      },
    }),
    deepsecTag(),
  ],
});

await runCli(paper);
