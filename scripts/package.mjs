import { mkdir, readFile, copyFile, cp, rm, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { createHash } from "node:crypto";

const { version } = JSON.parse(await readFile("package.json", "utf8"));
await mkdir("release", { recursive: true });
const checksums = [];
for (const browser of ["chrome", "edge"]) {
  for (const file of ["README.md", "README.en.md", "README.es.md", "README.ja.md",
    "README.pt-BR.md", "LICENSE", "PRIVACY.md", "DISCLAIMER.md", "CHANGELOG.md",
    "CONTRIBUTING.md", "SECURITY.md"]) {
    const text = (await readFile(file, "utf8"))
      .replaceAll("docs/验证记录.md", "docs/verification.md")
      .replaceAll("docs/需求与技术说明.md", "docs/specification.md");
    await writeFile(`dist/${browser}/${file}`, text);
  }
  // ASCII archive paths avoid legacy ZIP filename decoding differences on Windows.
  await rm(`dist/${browser}/docs`, { recursive: true, force: true });
  await mkdir(`dist/${browser}/docs`, { recursive: true });
  await copyFile("docs/验证记录.md", `dist/${browser}/docs/verification.md`);
  await copyFile("docs/需求与技术说明.md", `dist/${browser}/docs/specification.md`);
  await copyFile("docs/RELEASING.md", `dist/${browser}/docs/RELEASING.md`);
  await copyFile("docs/ROADMAP.md", `dist/${browser}/docs/ROADMAP.md`);
  await cp("docs/screenshots", `dist/${browser}/docs/screenshots`, { recursive: true });
  const archive = `xpremium-helper-${browser}-${version}-preview.zip`;
  // -FS removes entries left over from earlier builds of the same archive.
  execFileSync("/usr/bin/zip", ["-q", "-r", "-FS",
    resolve(`release/${archive}`), "."],
  { cwd: `dist/${browser}` });
  const hash = createHash("sha256").update(await readFile(`release/${archive}`)).digest("hex");
  checksums.push(`${hash}  ${archive}`);
}
await writeFile("release/SHA256SUMS", checksums.join("\n") + "\n");
console.log("Created preview ZIPs in release/.");
