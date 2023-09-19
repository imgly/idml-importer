import dts from "bun-plugin-dts";

await Bun.build({
  entrypoints: ["./entries/node.ts"],
  outdir: "./dist",
  target: "node",
  plugins: [dts()],
});

await Bun.build({
  entrypoints: ["./entries/browser.ts"],
  outdir: "./dist",
  target: "browser",
  plugins: [dts()],
});
