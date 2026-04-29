import { SYSTEM_PROMPT } from "@webaura/pi/agent/system-prompt";
import type { ExtensionManifest } from "@webaura/pi/extensions/types";

function formatExtensionCapabilities(extension: ExtensionManifest): string {
  const capabilities = extension.capabilities?.filter((capability) => capability.trim()) ?? [];

  if (capabilities.length === 0) {
    return `- ${extension.name}: ${extension.description}`;
  }

  return `- ${extension.name}: ${capabilities.join("; ")}`;
}

export function buildExtensionSystemPrompt(extensions: ExtensionManifest[]): string {
  if (extensions.length === 0) {
    return SYSTEM_PROMPT;
  }

  return `${SYSTEM_PROMPT}

Enabled extensions:
${extensions.map(formatExtensionCapabilities).join("\n")}

Use enabled extension tools only when they are relevant to the user's request. Do not claim extension access unless the corresponding tool is available in this turn.`;
}
