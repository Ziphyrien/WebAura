import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vite-plus/test";

async function readProjectFile(filePath: string): Promise<string> {
  return await readFile(join(process.cwd(), filePath), "utf8");
}

describe("extension architecture boundaries", () => {
  it("keeps core extension runtime free of concrete GitHub extension imports", async () => {
    const files = await Promise.all(
      [
        "packages/pi/src/extensions/runtime.ts",
        "packages/pi/src/extensions/runtime-provider.ts",
        "packages/pi/src/extensions/settings.ts",
        "packages/pi/src/extensions/registry.ts",
        "packages/pi/src/agent/session-worker-coordinator.ts",
      ].map((filePath) => readProjectFile(filePath)),
    );

    expect(files.join("\n")).not.toMatch(
      /@webaura\/extensions|extensions\/built-ins|github-token|repo\/github-token/,
    );
  });

  it("keeps shared settings UI free of concrete GitHub settings panels", async () => {
    const files = await Promise.all(
      [
        "packages/ui/src/components/extensions-settings.tsx",
        "packages/ui/src/components/settings-dialog.tsx",
        "packages/ui/src/lib/search-state.ts",
      ].map((filePath) => readProjectFile(filePath)),
    );

    expect(files.join("\n")).not.toMatch(
      /@webaura\/extensions|GithubTokenSettings|github-token-settings|Settings -> GitHub/,
    );
  });

  it("exports extension packages instead of internal extension files", async () => {
    const packageJson = JSON.parse(await readProjectFile("packages/extensions/package.json")) as {
      exports: Record<string, unknown>;
    };

    expect(Object.keys(packageJson.exports)).toEqual(["./github"]);
    expect(packageJson.exports).not.toHaveProperty("./github/runtime");
    expect(packageJson.exports).not.toHaveProperty("./github/token");
    expect(packageJson.exports).not.toHaveProperty("./github/ui");
  });

  it("installs concrete GitHub extension packages only in the app composition layer", async () => {
    const runtimeInstall = await readProjectFile("apps/web/src/extensions/runtime.ts");
    const uiInstall = await readProjectFile("apps/web/src/extensions/ui.tsx");

    expect(runtimeInstall).toContain("@webaura/extensions/github");
    expect(uiInstall).toContain("@webaura/extensions/github");
    expect(`${runtimeInstall}\n${uiInstall}`).not.toMatch(
      /@webaura\/extensions\/github\/(runtime|token|ui|manifest)/,
    );
  });
});
