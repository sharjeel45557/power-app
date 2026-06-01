import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  target: "es2022",
  platform: "node",
  clean: true,
  sourcemap: true,
  // Keep node_modules external; bundle only our workspace code.
  skipNodeModulesBundle: true,
  dts: false,
});
