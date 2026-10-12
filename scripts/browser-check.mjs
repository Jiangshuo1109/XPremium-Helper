import { chromium } from "playwright";
import { build } from "esbuild";
import { mkdtemp, mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve, join } from "node:path";
import { pathToFileURL } from "node:url";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";

await mkdir("artifacts", { recursive: true });
await build({
  entryPoints: ["tests/fixtures.ts"], outfile: "artifacts/fixtures.mjs",
  format: "esm", platform: "node",
});
const { fixture } = await import(pathToFileURL(resolve("artifacts/fixtures.mjs")).href);
const results = [];
const targets = [
  { name: "chromium", channel: "chromium", folder: "chrome", required: true },
  { name: "chrome", channel: "chrome", folder: "chrome", required: false },
  { name: "edge", channel: "msedge", folder: "edge", required: false },
];

for (const target of targets) {
  const profile = await mkdtemp(join(tmpdir(), "xfh-test-"));
  const extension = resolve(`dist/${target.folder}`);
  let context;
  const result = { browser: target.name, environment: "isolated-local-fixture", checks: [], errors: [] };
  try {
    context = await chromium.launchPersistentContext(profile, {
      channel: target.channel,
      headless: true,
      viewport: { width: 1280, height: 900 },
      args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`],
    });
    result.version = context.browser()?.version();
    // Never send fixture requests to X or reuse the user's authenticated profile.
    await context.route("**/*", route => {
      const url = new URL(route.request().url());
      if (url.protocol === "chrome-extension:") return route.continue();
      if (url.origin === "https://x.com") return route.fulfill({ contentType: "text/html", body: fixture(true) });
      return route.abort();
    });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.goto("https://x.com/home");
    await page.locator("[data-xfh-root]").waitFor({ timeout: 8000 });
    result.checks.push("unpacked-extension-loaded");
    const quick = page.locator("[data-xfh-root] button");
    assert.equal(await quick.count(), 5);
    assert.equal(await page.getByRole("button", { name: "回关 @bob", exact: true }).count(), 1);
    assert.deepEqual(await quick.evaluateAll(buttons => buttons.map(button => button.dataset.action).sort()),
      ["follow", "follow", "follow-back", "unfollow", "unfollow"]);
    result.checks.push("known-only-follow-and-follow-back");
    await page.evaluate(() => {
      const cell = document.querySelector('[aria-label="Following @carol"]').closest('[data-testid="UserCell"]');
      const badge = document.createElement("span");
      badge.dataset.testid = "userFollowIndicator";
      badge.textContent = "Follows you";
      cell.append(badge);
    });
    const friend = page.locator('[data-xfh-root] [data-friend][data-handle="carol"]');
    await friend.waitFor({ state: "attached" });
    assert.equal(await friend.evaluate(node => node.tagName), "SPAN");
    assert.equal(await friend.getAttribute("tabindex"), null);
    assert.equal(await friend.textContent(), "蓝朋友");
    result.checks.push("mutual-friend-is-a-noninteractive-label");

    for (const [name, width, height, dark] of [
      ["desktop-light", 1280, 900, false],
      ["desktop-dark", 1280, 900, true],
      ["narrow-light", 390, 844, false],
      ["narrow-dark", 390, 844, true],
    ]) {
      await page.setViewportSize({ width, height });
      await page.evaluate(dark => document.body.classList.toggle("dark", dark), dark);
      await page.waitForFunction(dark => {
        const button = document.querySelector("[data-xfh-root]")?.shadowRoot?.querySelector("button");
        return button && button.hasAttribute("data-dark") === dark;
      }, dark);
      const geometry = await quick.evaluateAll(buttons => buttons.filter(b => !b.hidden).map(button => {
        const rect = button.getBoundingClientRect();
        const article = [...document.querySelectorAll("article")].find(article =>
          article.querySelector(`a[href="/${button.dataset.handle}"]`));
        const body = article?.querySelector(".post-body")?.getBoundingClientRect();
        return { left: rect.left, right: rect.right, bottom: rect.bottom,
          width: rect.width, overflow: button.scrollWidth > button.clientWidth,
          bodyOverlap: body && rect.right > body.left && rect.left < body.right,
          dark: button.hasAttribute("data-dark") };
      }));
      assert.ok(geometry.length >= 2);
      for (const box of geometry) {
        assert.ok(box.left >= 0 && box.right <= width && box.bottom <= height);
        assert.equal(box.overflow, false);
        assert.equal(box.bodyOverlap, false);
        assert.equal(box.dark, dark);
      }
      await page.screenshot({ path: `artifacts/${target.name}-${name}.png` });
      result.checks.push(name);
    }
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.getByRole("button", { name: "关注 @alice", exact: true }).first().click();
    await page.getByRole("button", { name: "取关 @alice", exact: true }).first().waitFor();
    assert.equal(await page.evaluate(() => window.fixtureClicks.alice), 1);
    result.checks.push("trusted-click-single-native-action-and-unfollow-ready-state");
    await page.getByRole("button", { name: "取关 @dave", exact: true }).click();
    const confirmation = page.locator("[data-xfh-root] dialog");
    await confirmation.waitFor();
    await page.screenshot({ path: `artifacts/${target.name}-unfollow-confirm.png` });
    assert.equal(await page.evaluate(() => window.fixtureClicks.dave ?? 0), 0);
    await confirmation.getByRole("button", { name: "取消", exact: true }).click();
    assert.equal(await page.evaluate(() => window.fixtureClicks.dave ?? 0), 0);
    await page.getByRole("button", { name: "取关 @dave", exact: true }).click();
    await confirmation.getByRole("button", { name: "确认取关", exact: true }).click();
    await page.waitForFunction(() => {
      const button = document.querySelector("[data-xfh-root]")?.shadowRoot?.querySelector('button[data-handle="dave"]');
      return button?.textContent === "关注";
    });
    assert.equal(await page.evaluate(() => window.fixtureClicks.dave), 1);
    assert.equal(await page.evaluate(() => window.fixtureConfirmClicks), 1);
    result.checks.push("unfollow-cancel-confirm-and-targeted-native-confirmation");

    await page.evaluate(() => {
      const composer = document.createElement("section");
      composer.innerHTML = '<div contenteditable="true" role="textbox" data-testid="tweetTextarea_0" aria-label="Reply test"></div>'
        + '<button data-testid="tweetButtonInline">回复</button>';
      document.body.append(composer);
      window.fixtureReplies = 0;
      composer.querySelector("button").addEventListener("click", () => window.fixtureReplies++);
    });
    const reply = page.getByRole("textbox", { name: "Reply test" });
    await reply.fill("Keyboard test");
    await reply.press("Shift+Enter");
    assert.equal(await page.evaluate(() => window.fixtureReplies), 0);
    await reply.press("Enter");
    await reply.press("Enter");
    assert.equal(await page.evaluate(() => window.fixtureReplies), 1);
    await reply.dispatchEvent("compositionstart");
    await reply.press("Enter");
    await reply.dispatchEvent("compositionend");
    await reply.press("Enter");
    assert.equal(await page.evaluate(() => window.fixtureReplies), 1);
    result.checks.push("reply-enter-shift-enter-ime-and-duplicate-lock");

    await page.evaluate(() => {
      const composer = document.createElement("section");
      composer.innerHTML = '<div contenteditable="true" role="textbox" data-testid="tweetTextarea_1" aria-label="Post test"></div>'
        + '<button data-testid="tweetButton">发帖</button>';
      document.body.append(composer);
      window.fixturePosts = 0;
      composer.querySelector("button").addEventListener("click", () => window.fixturePosts++);
    });
    const postEditor = page.getByRole("textbox", { name: "Post test" });
    await postEditor.fill("Local post test");
    await postEditor.press("Shift+Enter");
    assert.equal(await page.evaluate(() => window.fixturePosts), 0);
    await postEditor.press("Enter");
    await postEditor.press("Enter");
    assert.equal(await page.evaluate(() => window.fixturePosts), 1);
    await postEditor.blur();
    result.checks.push("post-enter-shift-enter-and-duplicate-lock");

    await page.evaluate(() => {
      const article = document.querySelector('article:has(a[href="/dave"])');
      article.style.display = "block";
      const header = document.createElement("div");
      header.style.display = "flex";
      header.append(article.querySelector(".avatar-column"), article.querySelector("header"));
      article.prepend(header);
      article.scrollIntoView();
    });
    await page.waitForFunction(() => {
      const button = document.querySelector("[data-xfh-root]").shadowRoot.querySelector('button[data-handle="dave"]');
      const text = document.querySelector('article:has(a[href="/dave"]) p');
      return !button.hidden && button.getBoundingClientRect().bottom <= text.getBoundingClientRect().top;
    });
    result.checks.push("detail-header-button-does-not-overlap-body");

    await page.evaluate(() => {
      document.querySelector('article:has(a[href="/bob"]) svg').remove();
    });
    await page.getByRole("button", { name: "回关 @bob", exact: true }).waitFor({ state: "detached" });
    result.checks.push("non-blue-follow-back-hidden");
    await page.evaluate(() => {
      const article = document.querySelector('article:has(a[href="/unknown"])').cloneNode(true);
      article.querySelector('[data-testid^="UserAvatar-Container-"]').dataset.testid = "UserAvatar-Container-quietreader";
      article.querySelectorAll('a[href="/unknown"]').forEach(link => {
        link.href = "/quietreader";
        if (!link.querySelector("img")) link.textContent = "@quietreader";
      });
      // Preserve the author's blue badge when replacing its visible name.
      const nameLink = article.querySelector('[data-testid="User-Name"] a');
      nameLink.innerHTML = '@quietreader<svg data-testid="icon-verified" style="fill:rgb(29,155,240)"></svg>';
      const anchor = article.querySelector('[data-testid^="UserAvatar-Container-"] a');
      anchor.addEventListener("mouseover", () => {
        const card = document.createElement("div");
        card.dataset.testid = "HoverCard";
        card.innerHTML = '<a href="/quietreader">@quietreader</a><button data-testid="999-follow" aria-label="Follow @quietreader">Follow</button>';
        document.body.append(card);
        window.fixtureQuietClip = getComputedStyle(card).clipPath;
      });
      anchor.addEventListener("mouseout", () => document.querySelector('[data-testid="HoverCard"]')?.remove());
      document.querySelector("main").prepend(article);
      article.scrollIntoView();
    });
    await page.getByRole("button", { name: "关注 @quietreader", exact: true }).waitFor({ timeout: 15000 });
    assert.equal(await page.evaluate(() => window.fixtureQuietClip), "inset(100%)");
    await page.locator('style[data-xfh-quiet]').waitFor({ state: "detached" });
    result.checks.push("background-card-clipped-before-first-render-and-cleaned");
    assert.equal(errors.length, 0, errors.join("\n"));

    const id = createHash("sha256").update(extension).digest("hex").slice(0, 32)
      .split("").map(char => String.fromCharCode(97 + parseInt(char, 16))).join("");
    const popup = await context.newPage();
    await popup.goto(`chrome-extension://${id}/popup.html`);
    await popup.locator("#enabled:not([disabled])").waitFor();
    assert.equal(await popup.locator("#enabled").isChecked(), true);
    await popup.locator("#enabled").uncheck();
    await page.locator("[data-xfh-root]").waitFor({ state: "detached" });
    await popup.reload();
    await popup.locator("#enabled:not([disabled])").waitFor();
    assert.equal(await popup.locator("#enabled").isChecked(), false);
    await popup.locator("#enabled").check();
    await page.locator("[data-xfh-root]").waitFor();
    result.checks.push("popup-storage-toggle-persistence");
    await page.goto("https://x.com/home");
    await page.locator("[data-xfh-root]").waitFor();
    await page.evaluate(() => {
      const cell = document.querySelector('[aria-label="Following @carol"]').closest('[data-testid="UserCell"]');
      const badge = document.createElement("span");
      badge.dataset.testid = "userFollowIndicator";
      badge.textContent = "Follows you";
      cell.append(badge);
    });
    await page.locator('[data-xfh-root] [data-friend][data-handle="carol"]').waitFor({ state: "attached" });
    await popup.waitForFunction(() =>
      [...document.querySelectorAll("#records li")].some(row =>
        row.textContent.includes("@carol") && row.textContent.includes("蓝朋友")));
    assert.equal(await popup.title(), "X 头像快捷关注");
    assert.equal(await popup.locator(".creator-profile").getAttribute("href"), "https://x.com/jiangza9");
    assert.equal(await popup.locator(".github").getAttribute("href"),
      "https://github.com/Jiangshuo1109/XPremium-Helper");
    await popup.locator("main").screenshot({ path: `artifacts/${target.name}-popup.png` });
    await popup.locator("#filter").selectOption("mutual");
    assert.equal(await popup.locator("#records li").count(), 1);
    assert.ok((await popup.locator("#records").innerText()).includes("@carol"));
    await popup.locator("main").screenshot({ path: `artifacts/${target.name}-popup-filtered.png` });
    await popup.locator("#filter").selectOption("all");
    await popup.locator("#search").fill("alice");
    assert.equal(await popup.locator("#records li").count(), 1);
    assert.ok((await popup.locator("#records").innerText()).includes("@alice"));
    await popup.locator("#search").fill("no_such_fixture_user");
    assert.equal(await popup.locator("#records").innerText(), "当前页面暂无可显示的关系");
    result.checks.push("popup-identity-author-link-search-filter-and-empty-state");
    result.status = "passed";
  } catch (error) {
    result.status = "not-passed";
    result.errors.push(String(error.message).slice(0, 1600));
    if (target.required) process.exitCode = 1;
  } finally {
    await context?.close();
    await rm(profile, { recursive: true, force: true });
    results.push(result);
    console.log(JSON.stringify(result));
  }
}

const manifest = JSON.parse(await readFile("dist/chrome/manifest.json", "utf8"));
assert.deepEqual(manifest.permissions, ["storage"]);
assert.deepEqual(manifest.content_scripts[0].matches, ["https://x.com/*"]);
await writeFile("artifacts/browser-results.json", JSON.stringify(results, null, 2) + "\n");
