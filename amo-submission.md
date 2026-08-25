# AMO public submission kit — "Transcript-First & Live Chat Guard" v1.1.19

Package: `F:\Documents\GitHub\transcript-first-guard\youtube-transcript-guard.zip`
MD5: `dece0bc2205e972cffcd9dfb79fe0ed2` (byte-identical xpi also in repo)
Extension ID: `transcript-first-guard@landis.cc` (already in manifest)

## Decisions (locked 2026-08-24)
- **Account:** personal — Michael Landis (matches SSRN publishing identity; no service-account ceremony)
- **Route:** WEB UI (addons.mozilla.org Developer Hub). No API credentials; first listing is a one-time human-reviewed submission and the web UI shows review status/screenshots directly.
- **Distribution channel:** **Unlisted** (self-distributed). AMO signs the xpi; we host it (GitHub Releases + fleet download pages). Users install from our link; updates flow through AMO when installed from the AMO URL.
- **License:** MPL-2.0 (matches repo; Mozilla's home license)
- **Homepage / support:** the GitHub repo — `https://github.com/DarkSky7/transcript-first-guard` (issues welcome). Fleet sites (planetwatch.cc/downloads etc.) are **distributors only**, not the tracker/home.

## Submission route (web UI)
1. Sign in to addons.mozilla.org as Michael Landis.
2. "Submit a New Add-on" → upload `transcript-first-guard.xpi` (or the byte-identical `youtube-transcript-guard.zip`).
3. Distribution channel: **Unlisted** (self-hosted / signed-only) → fill minimal metadata → submit.
4. AMO signs it; grab the signed xpi + its download URL from the Developer Hub.
5. Host the signed xpi in GitHub Releases and the fleet downloads pages; keep the same package for future version bumps (AMO keeps the ID).

## Metadata (for listed use later, or to enrich unlisted)

**Name:** Transcript-First & Live Chat Guard

**Summary (≤250 chars):**
Opens the YouTube transcript automatically and collapses live chat, with one-click controls to re-open the chat or close the transcript — remembered for the current session.

**Detailed description (markdown):**
On YouTube watch pages this extension:
- **Opens the transcript automatically** whenever one exists — no more hunting for the button.
- **Collapses the live-chat pane** on live/broadcast pages so the video is front and center.
- Adds a small floating control (bottom-right) with two buttons:
  - **🡹/🡻 Live Chat** — re-enable the chat pane, or collapse it again.
  - **✕/↺ Transcript** — close the transcript, or bring it back.
- Remembers your choices for the current browsing session (subsequent videos in the same tab follow your last choice); a fresh tab returns to the defaults. All preferences are stored only in your browser (chrome.storage.sync).
- Handles YouTube's single-page navigation: works on videos, live streams, and playlist hops without reloading.
- Also available for Chromium as an unpacked extension — see the GitHub repo for install instructions.

**Categories:** Photos, Music & Videos

**License:** MPL-2.0

**Privacy policy (required only for public/listed):**
This extension collects no data. It does not use analytics, tracking, or remote code. All settings (the transcript/chat preferences) are stored locally in your browser's extension storage and never transmitted anywhere. The extension only reads and interacts with YouTube watch pages.

**Homepage / support:** https://github.com/DarkSky7/transcript-first-guard (issues welcome) · fleet downloads: https://planetwatch.cc/downloads

**Version notes (1.1.19):**
First public release. Auto-opens the transcript once the page settles; collapses live chat by default; one-click re-enable/close controls; session memory; compatible with Firefox, Zen, and Chromium-based browsers.

## Checklist before submit
- [x] Account: personal (Michael Landis, SSRN match)
- [x] License: MPL-2.0
- [x] Homepage/support: GitHub repo (DarkSky7/transcript-first-guard); fleet = distributors only
- [x] Repo pushed to GitHub (home + issue tracker live)
- [x] Route: web UI, unlisted channel
- [ ] Screenshots (2–3): float buttons on a watch page; transcript open + chat collapsed — generate if wanted
- [ ] Upload, note the signed-xpi URL, host it in GitHub Releases + fleet pages
