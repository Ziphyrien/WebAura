import type { AgentTool } from "@mariozechner/pi-agent-core";
import type { Static, TSchema } from "typebox";
import type {
  ExtensionAPI,
  ExtensionId,
  ExtensionManifest,
  ExtensionRuntimeSnapshot,
  AnyRegisteredExtensionTool,
  ExtensionToolDefinition,
  WebAuraExtension,
} from "@webaura/pi/extensions/types";

const EXTENSION_ID_PATTERN = /^[a-z][a-z0-9-]*(?:\.[a-z][a-z0-9-]*)*$/;
const TOOL_NAME_PATTERN = /^[a-z][a-z0-9_]*$/;

function validateExtensionManifest(manifest: ExtensionManifest): void {
  if (!EXTENSION_ID_PATTERN.test(manifest.id)) {
    throw new Error(`Invalid extension id: ${manifest.id}`);
  }

  if (!manifest.name.trim()) {
    throw new Error(`Extension ${manifest.id} must define a name`);
  }
}

function validateToolName(extensionId: ExtensionId, toolName: string): void {
  if (!TOOL_NAME_PATTERN.test(toolName)) {
    throw new Error(`Extension ${extensionId} registered invalid tool name: ${toolName}`);
  }
}

class ExtensionToolRegistry implements ExtensionAPI {
  private readonly registeredToolNames: Set<string>;
  readonly tools: AnyRegisteredExtensionTool[] = [];

  constructor(
    private readonly extensionId: ExtensionId,
    registeredToolNames: Set<string>,
  ) {
    this.registeredToolNames = registeredToolNames;
  }

  registerTool<TParameters extends TSchema, TDetails = unknown>(
    definition: ExtensionToolDefinition<TParameters, TDetails>,
  ): void {
    validateToolName(this.extensionId, definition.name);

    if (this.registeredToolNames.has(definition.name)) {
      throw new Error(`Tool ${definition.name} is already registered`);
    }

    this.registeredToolNames.add(definition.name);

    const tool: AgentTool<any, TDetails> = {
      ...definition,
      execute: async (toolCallId, params, signal, onUpdate) =>
        await definition.execute(
          toolCallId,
          params as Static<TParameters>,
          {
            extensionId: this.extensionId,
            signal,
          },
          onUpdate,
        ),
    };

    this.tools.push({
      extensionId: this.extensionId,
      tool,
    });
  }
}

export async function collectExtensionTools(
  extensions: WebAuraExtension[],
): Promise<AnyRegisteredExtensionTool[]> {
  const registeredToolNames = new Set<string>();
  const tools: AnyRegisteredExtensionTool[] = [];

  for (const extension of extensions) {
    validateExtensionManifest(extension.manifest);
    const registry = new ExtensionToolRegistry(extension.manifest.id, registeredToolNames);
    await extension.register(registry);
    tools.push(...registry.tools);
  }

  return tools;
}

export async function createExtensionRuntimeSnapshot(
  extensions: WebAuraExtension[],
): Promise<ExtensionRuntimeSnapshot> {
  const tools = await collectExtensionTools(extensions);

  return {
    enabledExtensions: extensions.map((extension) => extension.manifest),
    tools: tools.map((entry) => entry.tool),
  };
}
