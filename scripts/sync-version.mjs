import { readFile, writeFile } from "node:fs/promises";

const { version } = JSON.parse(await readFile("package.json", "utf8"));
if (!/^\d+\.\d+\.\d+$/.test(version)) {
  throw new Error("Use a three-part numeric version; preview status belongs in the Git tag.");
}
const manifest = JSON.parse(await readFile("public/manifest.json", "utf8"));
manifest.version = version;
manifest.name = `X 头像快捷关注（${version} 预览版）`;
await writeFile("public/manifest.json", JSON.stringify(manifest, null, 2) + "\n");
console.log(`Synced extension version ${version}.`);
