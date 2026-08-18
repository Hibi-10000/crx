import { defineConfig } from "tsdown";

export default defineConfig({
  entry: [
    "src/cli.ts",
    "src/index.ts",
  ],
  unbundle: true,
  sourcemap: true,
  format: "esm",
  cjsDefault: false,
  fixedExtension: false,
  dts: {
    oxc: true,
  },
  deps: {
    neverBundle: true,
  },
  platform: "node",
  report: {
    gzip: false,
  },
});
