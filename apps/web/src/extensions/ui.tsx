import { githubExtensionSettings } from "@firefly/extensions/github";
import type { ExtensionSettingsEntry } from "@firefly/ui/components/extensions-settings";

export const WEB_EXTENSION_SETTINGS = [
  githubExtensionSettings,
] satisfies readonly ExtensionSettingsEntry[];
