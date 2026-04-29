import { EMPTY_EXTENSION_RUNTIME } from "@webaura/pi/extensions/runtime";
import type { ExtensionRuntimeSnapshot } from "@webaura/pi/extensions/types";

export type ExtensionRuntimeResolver = () => Promise<ExtensionRuntimeSnapshot>;

let extensionRuntimeResolver: ExtensionRuntimeResolver = async () => EMPTY_EXTENSION_RUNTIME;

export function configureExtensionRuntimeResolver(resolver: ExtensionRuntimeResolver): void {
  extensionRuntimeResolver = resolver;
}

export async function resolveEnabledExtensionRuntime(): Promise<ExtensionRuntimeSnapshot> {
  return await extensionRuntimeResolver();
}

export function resetExtensionRuntimeResolver(): void {
  extensionRuntimeResolver = async () => EMPTY_EXTENSION_RUNTIME;
}
