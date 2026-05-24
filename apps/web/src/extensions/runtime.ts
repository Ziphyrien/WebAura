import { githubExtensionPackage } from "@firefly/extensions/github";
import type { ExtensionPackage } from "@firefly/pi/extensions/types";

export const WEB_EXTENSION_PACKAGES = [
  githubExtensionPackage,
] satisfies readonly ExtensionPackage[];
