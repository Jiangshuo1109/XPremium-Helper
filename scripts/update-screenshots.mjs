import { copyFile, mkdir, readFile } from "node:fs/promises";

const results = JSON.parse(await readFile("artifacts/browser-results.json", "utf8"));
const chromium = results.find(result => result.browser === "chromium");
if (chromium?.status !== "passed") throw new Error("Run and pass npm run test:browser before updating screenshots");
await mkdir("docs/screenshots", { recursive: true });
for (const name of ["desktop-light", "desktop-dark", "narrow-light", "unfollow-confirm", "popup", "popup-filtered"]) {
  await copyFile(`artifacts/chromium-${name}.png`, `docs/screenshots/${name}.png`);
}
console.log("Copied six verified Chromium fixture screenshots.");
