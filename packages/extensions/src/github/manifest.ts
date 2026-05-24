import type { ExtensionManifest } from "@firefly/pi/extensions/types";

export const GITHUB_EXTENSION_ID = "github";

export const githubExtensionManifest = {
  author: "Firefly",
  capabilities: ["Search", "Repository reads", "Issues", "Pull requests", "Actions", "Raw API"],
  description: "GitHub search, repository reads, issues, pull requests, Actions, and API calls.",
  homepageUrl: "https://github.com/Ziphyrien/Firefly",
  id: GITHUB_EXTENSION_ID,
  name: "GitHub",
  version: "0.1.0",
} satisfies ExtensionManifest;

export const GITHUB_EXTENSION_DEFAULT_ENABLED = false;
