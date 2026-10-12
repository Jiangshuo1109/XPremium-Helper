import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const load = async path => JSON.parse(await readFile(path, "utf8"));
const pkg = await load("package.json");
const lock = await load("package-lock.json");
const manifest = await load("public/manifest.json");
assert.match(pkg.version, /^\d+\.\d+\.\d+$/);
assert.equal(lock.version, pkg.version);
assert.equal(lock.packages[""].version, pkg.version);
assert.equal(manifest.version, pkg.version);
assert.ok(manifest.name.includes(pkg.version), "Manifest display name must match the package version");
assert.equal(pkg.license, "MIT");
const tag = process.env.GITHUB_REF_TYPE === "tag" ? process.env.GITHUB_REF_NAME : process.argv[2];
if (tag) assert.equal(tag, `v${pkg.version}-preview`, "Tag must match the preview package version");
const changelog = await readFile("CHANGELOG.md", "utf8");
assert.ok(changelog.includes(`## [${pkg.version}]`), "Add this version to CHANGELOG.md");
for (const file of ["LICENSE", "PRIVACY.md", "DISCLAIMER.md", "README.md", "README.en.md", "README.es.md", "README.ja.md", "README.pt-BR.md"]) {
  const text = await readFile(file, "utf8");
  assert.ok(text.trim(), `${file} must not be empty`);
  if (file.startsWith("README")) {
    assert.ok(text.includes(pkg.version), `Update the current version in ${file}`);
  }
}
console.log(`Release metadata is consistent: ${pkg.version}.`);
