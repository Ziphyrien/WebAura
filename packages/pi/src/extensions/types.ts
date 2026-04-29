import type {
  AgentTool,
  AgentToolResult,
  AgentToolUpdateCallback,
} from "@mariozechner/pi-agent-core";
import type { Static, TSchema } from "typebox";

export type ExtensionId = string;

export interface ExtensionManifest {
  author?: string;
  capabilities?: string[];
  description: string;
  homepageUrl?: string;
  id: ExtensionId;
  name: string;
  version: string;
}

export interface ExtensionToolExecutionContext {
  extensionId: ExtensionId;
  signal?: AbortSignal;
}

export type ExtensionToolExecute<TParameters extends TSchema, TDetails> = (
  toolCallId: string,
  params: Static<TParameters>,
  context: ExtensionToolExecutionContext,
  onUpdate?: AgentToolUpdateCallback<TDetails>,
) => Promise<AgentToolResult<TDetails>>;

export type ExtensionToolDefinition<
  TParameters extends TSchema = TSchema,
  TDetails = unknown,
> = Omit<AgentTool<TParameters, TDetails>, "execute"> & {
  execute: ExtensionToolExecute<TParameters, TDetails>;
};

export interface ExtensionAPI {
  registerTool<TParameters extends TSchema, TDetails = unknown>(
    definition: ExtensionToolDefinition<TParameters, TDetails>,
  ): void;
}

export interface WebAuraExtension {
  defaultEnabled?: boolean;
  manifest: ExtensionManifest;
  register(api: ExtensionAPI): void | Promise<void>;
}

export type ExtensionPackageSource =
  | {
      kind: "bundled";
      packageId: string;
    }
  | {
      kind: "uploaded";
      packageId: string;
      revision?: string;
    };

export interface ExtensionPackage {
  defaultEnabled?: boolean;
  loadRuntime(): Promise<WebAuraExtension>;
  manifest: ExtensionManifest;
  source: ExtensionPackageSource;
}

/** Metadata WebAura can persist before a user-uploaded package is loaded or enabled. */
export interface UploadedExtensionPackageDescriptor {
  entrypoints: {
    runtime: string;
    settings?: string;
  };
  files: Array<{
    mediaType?: string;
    path: string;
    size?: number;
  }>;
  manifest: ExtensionManifest;
}

export interface RegisteredExtensionTool<
  TParameters extends TSchema = TSchema,
  TDetails = unknown,
> {
  extensionId: ExtensionId;
  tool: AgentTool<TParameters, TDetails>;
}

export type AnyRegisteredExtensionTool = RegisteredExtensionTool<any, any>;

export interface ExtensionRuntimeSnapshot {
  enabledExtensions: ExtensionManifest[];
  tools: AgentTool[];
}
