import vinext from "vinext";
import { nitro } from "nitro/vite";
import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";

// macOS Seatbelt blocks FSEvents, so Codex previews need polling for HMR.
const isCodexSeatbeltSandbox = process.env.CODEX_SANDBOX === "seatbelt";

export default defineConfig({
  // Keep the CSS import local when Nitro externalizes server dependencies.
  resolve: {
    alias: [{
      find: /^tailwindcss$/,
      replacement: fileURLToPath(import.meta.resolve("tailwindcss/index.css")),
    }],
  },
  server: isCodexSeatbeltSandbox
    ? { watch: { useFsEvents: false, usePolling: true } }
    : undefined,
  plugins: [vinext(), nitro()],
});
