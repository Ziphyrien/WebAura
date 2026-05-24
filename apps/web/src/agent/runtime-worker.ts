import { getEnabledExtensionRuntime } from "@firefly/pi/extensions/runtime";
import { configureExtensionRuntimeResolver } from "@firefly/pi/extensions/runtime-provider";
import { WEB_EXTENSION_PACKAGES } from "@/extensions/runtime";

configureExtensionRuntimeResolver(
  async () => await getEnabledExtensionRuntime(WEB_EXTENSION_PACKAGES),
);

export * from "@firefly/pi/agent/runtime-worker";
