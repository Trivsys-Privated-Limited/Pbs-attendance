import { resolve } from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "electron-vite";

export default defineConfig({
  main: {
    build: {
      outDir: "out/main",
    },
  },
  preload: {
    build: {
      outDir: "out/preload",
    },
  },
  renderer: {
    root: resolve(__dirname, "src/renderer"),
    resolve: {
      alias: {
        "@renderer": resolve(__dirname, "src/renderer/src"),
      },
    },
    build: {
      outDir: resolve(__dirname, "out/renderer"),
      minify: true,
    },
    plugins: [react(), tailwindcss()],
  },
});
