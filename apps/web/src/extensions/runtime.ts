import { githubExtensionPackage } from "@webaura/extensions/github";
import type { ExtensionPackage } from "@webaura/pi/extensions/types";

export const WEB_EXTENSION_PACKAGES = [
  githubExtensionPackage,
] satisfies readonly ExtensionPackage[];
