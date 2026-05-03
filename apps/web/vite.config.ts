import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { nitro } from "nitro/vite";
import { fileURLToPath } from "node:url";
import { defineConfig, type PluginOption } from "vite-plus";
import { comlink } from "vite-plugin-comlink";

const asPlugin = (plugin: unknown): PluginOption => plugin as PluginOption;

const plugins: PluginOption[] = [
  asPlugin(comlink()),
  asPlugin(nitro()),
  asPlugin(tailwindcss()),
  asPlugin(
    tanstackStart({
      importProtection: {
        behavior: {
          build: "mock",
        },
        mockAccess: "off",
      },
    }),
  ),
  asPlugin(viteReact()),
];

const workerPlugins = () => [asPlugin(comlink())];

export default defineConfig({
  optimizeDeps: {
    include: [
      "streamdown",
      "@streamdown/cjk",
      "@streamdown/code",
      "@streamdown/math",
      "@streamdown/mermaid",
      "mermaid",
      "dayjs",
      "@braintree/sanitize-url",
    ],
  },
  plugins,
  resolve: {
    alias: {
      "@webaura/pi/agent/runtime-worker-client": fileURLToPath(
        new URL("./src/agent/runtime-worker-client.ts", import.meta.url),
      ),
    },
    tsconfigPaths: true,
  },
  server: {
    port: 3001,
  },
  worker: {
    format: "es",
    plugins: workerPlugins,
  },
});
