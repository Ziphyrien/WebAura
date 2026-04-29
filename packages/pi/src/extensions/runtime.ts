import { createExtensionRuntimeSnapshot } from "@webaura/pi/extensions/registry";
import { getExtensionEnabled } from "@webaura/pi/extensions/settings";
import { loadExtensionPackageRuntime } from "@webaura/pi/extensions/packages";
import type {
  ExtensionManifest,
  ExtensionPackage,
  ExtensionRuntimeSnapshot,
  WebAuraExtension,
} from "@webaura/pi/extensions/types";

export const EMPTY_EXTENSION_RUNTIME: ExtensionRuntimeSnapshot = {
  enabledExtensions: [],
  tools: [],
};

export function getInstalledExtensions(
  extensionPackages: readonly Pick<ExtensionPackage, "manifest">[],
): ExtensionManifest[] {
  return extensionPackages.map((extensionPackage) => extensionPackage.manifest);
}

export async function getExtensionCatalog(
  extensionPackages: readonly Pick<ExtensionPackage, "defaultEnabled" | "manifest">[],
): Promise<Array<{ enabled: boolean; manifest: ExtensionManifest }>> {
  return await Promise.all(
    extensionPackages.map(async (extensionPackage) => ({
      enabled: await getExtensionEnabled(extensionPackage),
      manifest: extensionPackage.manifest,
    })),
  );
}

export async function getEnabledExtensionRuntime(
  extensionPackages: readonly ExtensionPackage[],
): Promise<ExtensionRuntimeSnapshot> {
  const enabledExtensions: WebAuraExtension[] = [];

  for (const extensionPackage of extensionPackages) {
    if (await getExtensionEnabled(extensionPackage)) {
      enabledExtensions.push(await loadExtensionPackageRuntime(extensionPackage));
    }
  }

  if (enabledExtensions.length === 0) {
    return EMPTY_EXTENSION_RUNTIME;
  }

  return await createExtensionRuntimeSnapshot(enabledExtensions);
}
