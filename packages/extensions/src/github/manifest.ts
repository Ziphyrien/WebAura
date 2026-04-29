import type { ExtensionManifest } from "@webaura/pi/extensions/types";

export const GITHUB_EXTENSION_ID = "github";

export const githubExtensionManifest = {
  author: "WebAura",
  capabilities: ["Search", "Repository reads", "Raw API"],
  description: "GitHub search, repository reads, and API calls.",
  homepageUrl: "https://github.com/Ziphyrien/WebAura",
  id: GITHUB_EXTENSION_ID,
  name: "GitHub",
  version: "0.1.0",
} satisfies ExtensionManifest;

export const GITHUB_EXTENSION_DEFAULT_ENABLED = false;
