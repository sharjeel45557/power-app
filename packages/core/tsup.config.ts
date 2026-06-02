import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    // `meta` is a pure-types entry safe to import from the browser bundle
    // (no drizzle/postgres dependencies leak into the web app).
    meta: "src/meta.ts",
  },
  format: ["esm"],
  dts: true,
  clean: true,
  sourcemap: true,
  target: "es2022",
});
