import { getEnabledExtensionRuntime } from "@webaura/pi/extensions/runtime";
import { configureExtensionRuntimeResolver } from "@webaura/pi/extensions/runtime-provider";
import { WEB_EXTENSION_PACKAGES } from "@/extensions/runtime";

configureExtensionRuntimeResolver(
  async () => await getEnabledExtensionRuntime(WEB_EXTENSION_PACKAGES),
);

export * from "@webaura/pi/agent/runtime-worker";
