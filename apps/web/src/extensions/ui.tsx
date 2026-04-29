import { githubExtensionSettings } from "@webaura/extensions/github";
import type { ExtensionSettingsEntry } from "@webaura/ui/components/extensions-settings";

export const WEB_EXTENSION_SETTINGS = [
  githubExtensionSettings,
] satisfies readonly ExtensionSettingsEntry[];
