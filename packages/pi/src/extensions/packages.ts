import type { ExtensionPackage, WebAuraExtension } from "@webaura/pi/extensions/types";

export function defineExtensionPackage<const TExtensionPackage extends ExtensionPackage>(
  extensionPackage: TExtensionPackage,
): TExtensionPackage {
  return extensionPackage;
}

export async function loadExtensionPackageRuntime(
  extensionPackage: ExtensionPackage,
): Promise<WebAuraExtension> {
  const extension = await extensionPackage.loadRuntime();

  if (extension.manifest.id !== extensionPackage.manifest.id) {
    throw new Error(
      `Extension package ${extensionPackage.manifest.id} loaded runtime ${extension.manifest.id}`,
    );
  }

  return {
    ...extension,
    defaultEnabled: extension.defaultEnabled ?? extensionPackage.defaultEnabled,
  };
}
