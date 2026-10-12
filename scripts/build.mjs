import { build } from "esbuild";
import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";

for (const browser of ["chrome", "edge"]) {
  await rm(`dist/${browser}`, { recursive: true, force: true });
}
await mkdir("dist/chrome", { recursive: true });
await cp("public", "dist/chrome", { recursive: true });
await build({
  entryPoints: ["src/content.ts", "src/popup.ts", "src/worker.ts"],
  outdir: "dist/chrome",
  bundle: true,
  format: "iife",
  target: "chrome120",
  legalComments: "none",
  sourcemap: false,
});
const manifest = JSON.parse(await readFile("dist/chrome/manifest.json", "utf8"));
const packageInfo = JSON.parse(await readFile("package.json", "utf8"));
manifest.version = packageInfo.version;
manifest.name = `X 头像快捷关注（${packageInfo.version} 预览版）`;
await writeFile("dist/chrome/manifest.json", JSON.stringify(manifest, null, 2) + "\n");
await cp("dist/chrome", "dist/edge", { recursive: true });
console.log(`Built Chrome and Edge preview v${manifest.version}.`);
