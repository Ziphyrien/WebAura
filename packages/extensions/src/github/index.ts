import { defineExtensionPackage } from "@webaura/pi/extensions/packages";
import {
  GITHUB_EXTENSION_DEFAULT_ENABLED,
  GITHUB_EXTENSION_ID,
  githubExtensionManifest,
} from "./manifest";
import type { ExtensionSettingsEntry } from "@webaura/ui/components/extensions-settings";

export const githubExtensionPackage = defineExtensionPackage({
  defaultEnabled: GITHUB_EXTENSION_DEFAULT_ENABLED,
  loadRuntime: async () => (await import("./runtime")).githubExtension,
  manifest: githubExtensionManifest,
  source: {
    kind: "bundled",
    packageId: GITHUB_EXTENSION_ID,
  },
});

export const githubExtensionSettings = {
  defaultEnabled: GITHUB_EXTENSION_DEFAULT_ENABLED,
  loadSettingsPanel: async () => (await import("./settings-panel")).GithubExtensionSettings,
  manifest: githubExtensionManifest,
} satisfies ExtensionSettingsEntry;
