# Transcript-First & Live Chat Guard

A browser extension for YouTube (Firefox / Zen / Chrome / Edge / Brave), MV3.

**Source & issues:** [github.com/DarkSky7/transcript-first-guard](https://github.com/DarkSky7/transcript-first-guard) — bug reports welcome; forks encouraged.

**What it does, by default, on every watch page you open:**

- **Opens the video's transcript** — automatically, for any video that has one.
- **Closes the live-chat pane** — collapsed by default on live / premiere
  broadcasts, so the description and transcript get the screen.

**The floating control** (bottom-right of the page) lets you override the
defaults for the *current and subsequently opened pages in the same tab*:

- **🡹 / 🡻 Live Chat** — click to re-show the live chat (or hide it again).
- **✕ / ↺ Transcript** — click to close the transcript panel (or reopen it).

Per-page choices are remembered for the rest of that tab; a fresh tab starts
from the default behaviour. The defaults themselves are switchable from the
extension's popup (the puzzle icon → *Transcript-First & Live Chat Guard*).

---

## Install

**Firefox / Zen:** install from [addons.mozilla.org](https://addons.mozilla.org)
(search *Transcript-First & Live Chat Guard*).

**Chromium (Chrome/Edge/Brave/Opera) — load unpacked:**

1. Download and unzip this folder (keep the folder intact).
2. Open `chrome://extensions` (or `edge://extensions`) in your browser.
3. Turn on **Developer mode** (top-right).
4. Click **Load unpacked** and select the unzipped **folder** (the one
   containing `manifest.json`).
5. The extension activates automatically. Open any YouTube watch page to see it
   work.

> No accounts, no data collection, no network activity beyond YouTube itself.
> It only arranges elements that are already on the page.

## Report a bug / contribute

- **Bugs:** open an issue here — the template asks for browser, version, video
  URL, and the on-page status line when available.
- **Contributions:** PRs welcome. The `test/` harness runs headless (Playwright
  Chromium, no Playwright Firefox needed) and catches most regressions without
  a real browser.

## Files

- `manifest.json` — extension manifest (MV3, includes the AMO `gecko.id`)
- `content.js` — the transcript/chat logic + floating control
- `content.css`, `popup.html`, `popup.js`, `icons/` — styles, options UI, icons
- `test/` — automated DOM-mock harness (`harness.html`) + Playwright tests
  (`pw_test.py`, `pw_late_test.py`, `serve_test.py`)
- `community-post.md` — field report: 10 traps when building YouTube
  extensions for Firefox
- `zen-bug-report.md` — upstream report draft (Zen hard-refresh video bug)

## Build your own copy (optional)

No build step is required — the folder is the loadable extension. To re-create
the distributable `.zip` on Windows:

```
powershell -Command "Compress-Archive -Path manifest.json,content.js,content.css,popup.html,popup.js,icons -DestinationPath youtube-transcript-guard.zip -Force"
```

## Verify the downloaded file (MD5)

Compute the checksum of the exact file you received and compare it to the MD5
listed on the site. One line for your shell:

- **Windows PowerShell**
  ```
  (Get-FileHash .\youtube-transcript-guard.zip -Algorithm MD5).Hash.ToLower()
  ```
- **Windows CMD**
  ```
  certutil -hashfile youtube-transcript-guard.zip MD5
  ```
- **Linux / macOS / Git-Bash**
  ```
  md5sum youtube-transcript-guard.zip
  ```

