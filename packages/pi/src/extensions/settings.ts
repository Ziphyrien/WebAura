import { deleteSetting, getSetting, setSetting } from "@webaura/db";
import type { ExtensionId, WebAuraExtension } from "@webaura/pi/extensions/types";

const EXTENSION_ENABLED_KEY_PREFIX = "extensions.enabled.";

export function getExtensionEnabledSettingKey(extensionId: ExtensionId): string {
  return `${EXTENSION_ENABLED_KEY_PREFIX}${extensionId}`;
}

function readBooleanSetting(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

export async function getExtensionEnabled(
  extension: Pick<WebAuraExtension, "defaultEnabled" | "manifest">,
): Promise<boolean> {
  const value = await getSetting(getExtensionEnabledSettingKey(extension.manifest.id));
  return readBooleanSetting(value) ?? Boolean(extension.defaultEnabled);
}

export async function setExtensionEnabled(
  extensionId: ExtensionId,
  enabled: boolean | undefined,
): Promise<void> {
  const key = getExtensionEnabledSettingKey(extensionId);

  if (enabled === undefined) {
    await deleteSetting(key);
    return;
  }

  await setSetting(key, enabled);
}
