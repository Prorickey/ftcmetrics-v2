import { defineConfig } from "tsup";

export default defineConfig([
  {
    entry: ["src/index.ts"],
    format: "esm",
    dts: true,
    outDir: "dist/esm",
    splitting: false,
    clean: true,
  },
  {
    entry: ["src/index.ts"],
    format: "cjs",
    outDir: "dist/cjs",
    outExtension: () => ({ js: ".cjs" }),
    splitting: false,
    clean: true,
  },
]);
