import dts from "bun-plugin-dts";

await Bun.build({
  entrypoints: ["./entries/node.ts"],
  outdir: "./dist",
  minify: true,
  target: "node",
  plugins: [dts()],
});

await Bun.build({
  entrypoints: ["./entries/browser.ts"],
  outdir: "./dist",
  minify: true,
  target: "browser",
  plugins: [dts()],
});
