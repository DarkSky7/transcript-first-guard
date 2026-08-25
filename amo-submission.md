# AMO public submission kit — "Transcript-First & Live Chat Guard" v1.1.19

Package: `F:\Documents\GitHub\youtube-live-friendly\youtube-transcript-guard.zip`
MD5: `c6a4a848c0da2eb09f1d5bd30a86c3e1` (byte-identical xpi also in repo)
Extension ID: `transcript-first-guard@landis.cc` (already in manifest)

## Submission route
1. Sign in to addons.mozilla.org (account decision: personal vs service — see below).
2. "Submit a New Add-on" → upload `youtube-transcript-guard.zip`.
3. Fill the fields below; distribution channel: **On this site (public listing)** → human review queue.
4. Keep the same package for future version bumps (AMO keeps the ID).

(Alternative: AMO API credentials from the Developer Hub → I can script the submission/updates via the API. Web UI is easier for the first listing — screenshots, etc.)

## Metadata

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
- Also available for Chromium as an unpacked extension (see https://planetwatch.cc/downloads).

**Categories:** Photos, Music & Videos

**License:** MPL-2.0 (proposal — confirm)

**Privacy policy (required for public listing):**
This extension collects no data. It does not use analytics, tracking, or remote code. All settings (the transcript/chat preferences) are stored locally in your browser's extension storage and never transmitted anywhere. The extension only reads and interacts with YouTube watch pages.

**Homepage / support:** https://github.com/DarkSky7/transcript-first-guard (issues welcome) · fleet downloads: https://planetwatch.cc/downloads

**Version notes (1.1.19):**
First public release. Auto-opens the transcript once the page settles; collapses live chat by default; one-click re-enable/close controls; session memory; compatible with Firefox, Zen, and Chromium-based browsers.

## Checklist before submit
- [ ] Account: personal (Michael Landis) or service account — DECISION
- [ ] License confirmed (MPL-2.0 proposed)
- [ ] Screenshots (2–3): float buttons on a watch page; transcript open + chat collapsed — generate if wanted
- [ ] Repo pushed to GitHub (homepage/source link) — `F:\Documents\GitHub\youtube-live-friendly` is local-only today
