# XPremium Helper

[简体中文](README.md) · [English](README.en.md) · [Español](README.es.md) · [日本語](README.ja.md) · [Português (Brasil)](README.pt-BR.md)

[![CI](https://github.com/Jiangshuo1109/XPremium-Helper/actions/workflows/ci.yml/badge.svg)](https://github.com/Jiangshuo1109/XPremium-Helper/actions/workflows/ci.yml) [![MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

A Chrome / Edge extension that adds follow, follow-back, and confirmed unfollow actions below X avatars after checking account identity and relationship evidence. Mutual follows receive a noninteractive label. Relationship changes require your click and use X's native controls.

**Version 0.2.2, preview.** Not affiliated with X Corp.; this extension does not provide or unlock X Premium. Real-world group-chat relationship detection is not yet validated. Documentation is available in five languages; the extension UI is Chinese, and native control recognition currently targets Chinese and English.

[Download preview](https://github.com/Jiangshuo1109/XPremium-Helper/releases) · [Report a bug](https://github.com/Jiangshuo1109/XPremium-Helper/issues) · [Changelog](CHANGELOG.md)

Maintained by **禁忌の小姜**. [Follow @jiangza9 on X](https://x.com/jiangza9) for updates and development notes. Following is optional and never unlocks features.

> ⚠️ **Disclaimer:** This is an independent preview extension and is not affiliated with X Corp. Check every action and follow applicable platform rules. The project does not guarantee relationship accuracy, platform results, or continued compatibility. Read the [full disclaimer](DISCLAIMER.md).

## Features In Use

Screenshots show the actual extension running against isolated fixtures with fictional accounts and posts. They do not demonstrate successful operations against X's servers.

![Follow actions and mutual-follow label in the light theme](docs/screenshots/desktop-light.png)

| Feature | Behavior |
| --- | --- |
| Avatar actions | Follow / follow back require a recognized blue badge and known relationship; unfollow is offered when following without confirmed mutual status |
| Mutual-follow label | “蓝朋友” appears only with explicit mutual-follow evidence and is not clickable |
| Unfollow confirmation | Shows the target handle and rechecks native controls before acting |
| Relationship panel | Search handles, filter relationships, and view detection progress; currently shows the last reported page, shared across tabs |
| Enter to post / reply | Enter submits a single composer; Shift+Enter inserts a newline; IME composition and mention selection are protected |
| Reading and cooldown | Up to 20 queued checks, a one-minute in-memory relationship cache, input priority, and 30-minute rate-limit cooldown handling |
| Layout | Light and dark themes plus narrow desktop windows; this does not imply mobile-browser extension support |

<details>
<summary>More screenshots: dark mode, confirmation, panel, and narrow window</summary>

![Dark theme](docs/screenshots/desktop-dark.png)
![Unfollow confirmation](docs/screenshots/unfollow-confirm.png)
![Relationship panel and author link](docs/screenshots/popup.png)
![Panel filtered to mutual follows](docs/screenshots/popup-filtered.png)
<img src="docs/screenshots/narrow-light.png" alt="390px desktop browser window" width="390">

</details>

## Install And Update

1. Open [Releases](https://github.com/Jiangshuo1109/XPremium-Helper/releases) and select the newest **Pre-release**. Download `xpremium-helper-chrome-<version>-preview.zip` or the `edge` equivalent, not GitHub's automatic “Source code” archive.
2. Extract into a permanent folder. Open `chrome://extensions` or `edge://extensions`.
3. Enable **Developer mode**, choose **Load unpacked**, and select the folder containing `manifest.json`.
4. Handle unsent drafts before refreshing existing X tabs. Use the extension popup to enable or disable it.
5. To update, replace the files in that folder, click **Reload** on the extension management page, and refresh X.

No store distribution or automatic updates are provided. Compare the archive against the release's `SHA256SUMS` using `shasum -a 256 <file.zip>` on macOS or `Get-FileHash <file.zip> -Algorithm SHA256` in PowerShell.

Start with a test account. **When enabled, Enter sends posts and replies in a single composer.** Shift+Enter inserts a newline. DMs, multi-composer threads, and scheduled posts retain their original behavior.

## Boundaries

Unknown identity, relationship, blue-badge status, or missing usable native controls can keep an action hidden. Follow / follow back require a recognized blue badge; unfollow and mutual labels do not. Self, conflicting identities, and pending requests are not treated as followable accounts.

Home, post details, replies, and follower / following lists have adapters. Group-chat profile actions require explicit sender relationship fields that still need live verification; DM lists and headers are unfinished. Absence of a “Follows you” marker does not prove someone does not follow you: check before confirming an unfollow.

The popup uses shared last-reported state and may show another X tab's records. A visible UI change does not prove server completion. Failed or timed-out relationship actions are never automatically retried. There is no automatic scrolling, bulk following / unfollowing, liking, or DM sending.

See the [verification record (Chinese)](docs/验证记录.md) for local checks versus unfinished live-site acceptance.

## Permissions And Data

Only `storage` is requested; content scripts run only on `https://x.com/*`. No API keys, telemetry, cookie permission, or extension backend. X itself still receives actions submitted through its native controls.

Settings and cooldown deadlines are local. Page summaries and one-time tasks prefer session storage, but **fall back to local storage when session storage is unavailable and may survive a browser restart**. See [Privacy](PRIVACY.md) for fields, retention, and removal.

## Development

Requires Node.js 22+, npm, and `zip` for packaging. On Windows, build with WSL or install a release archive.

```sh
git clone https://github.com/Jiangshuo1109/XPremium-Helper.git
cd XPremium-Helper
npm ci
npm run check
npx playwright install chromium
npm run test:browser
npm run check:release
npm run package
```

Load `dist/chrome` or `dist/edge`. Archives go to `release/`; reports go to `artifacts/`. Both are excluded from Git. Public screenshots live in `docs/screenshots/`.

Browser tests use intercepted network requests and fictional fixtures. Chromium is required; missing or failing local Chrome / Edge targets remain reported as not passed. Fixture success is not live-site acceptance.

[Contribute](CONTRIBUTING.md) · [Security](SECURITY.md) · [Disclaimer](DISCLAIMER.md) · [Release process](docs/RELEASING.md) · [Roadmap](docs/ROADMAP.md)

Remove real conversations, account lists, credentials, and personal paths before sharing reports. Subscribe via **Watch → Custom → Releases**, or follow [禁忌の小姜 @jiangza9](https://x.com/jiangza9).

## License

[MIT](LICENSE). Use, modify, and redistribute, including commercially, while retaining the copyright and license notice. Dependencies retain their own licenses; X trademarks belong to their owners.
