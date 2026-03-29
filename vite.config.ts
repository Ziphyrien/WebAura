import { defineConfig } from "vite"
import { comlink } from "vite-plugin-comlink"
import { devtools } from "@tanstack/devtools-vite"
import { tanstackStart } from "@tanstack/react-start/plugin/vite"
import viteReact from "@vitejs/plugin-react"
import viteTsConfigPaths from "vite-tsconfig-paths"
import { nodePolyfills } from "vite-plugin-node-polyfills"
import tailwindcss from "@tailwindcss/vite"
import { nitro } from "nitro/vite"

function createTsConfigPathsPlugin() {
  return viteTsConfigPaths({
    projects: ["./tsconfig.json"],
  })
}

function createNodePolyfillsPlugin() {
  return nodePolyfills({
    include: ["process", "zlib"],
  })
}

const config = defineConfig({
  plugins: [
    comlink(),
    devtools(),
    nitro(),
    createNodePolyfillsPlugin(),
    // this is the plugin that enables path aliases
    createTsConfigPathsPlugin(),
    tailwindcss(),
    tanstackStart(),
    viteReact(),
  ],
  worker: {
    plugins: () => [
      createTsConfigPathsPlugin(),
      createNodePolyfillsPlugin(),
      comlink(),
    ],
  },
})

export default config
