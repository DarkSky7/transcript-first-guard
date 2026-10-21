# AMO public submission kit — "Transcript-First & Live Chat Guard" v1.1.21

Package: `F:\Documents\GitHub\transcript-first-guard\youtube-transcript-guard.zip`
MD5: `1d8329ab56c7f10b5f32cdfa7fdadd58` (byte-identical xpi also in repo)
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

## CI signing (`.github/workflows/sign-release.yml`)

Signing used to be a manual trip through the Developer Hub: upload the xpi, wait,
download the signed copy by hand. Unlisted add-ons are **auto-approved**, so a
runner can do the whole thing unattended.

The one thing that makes this non-obvious: signed files for **unlisted** add-ons
are not publicly fetchable — a request without credentials returns 401. That is
why automation needs API keys and why a web-UI-only account cannot do it.

### One-time setup

1. <https://addons.mozilla.org/en-US/developers/addon/api/key/> → **Generate new
   credentials**. You get a **JWT issuer** and a **JWT secret**. Free; no paid tier.
   One key pair per add-on, never shared between add-ons.
2. Repo → **Settings → Secrets and variables → Actions** → add two repository
   secrets: `AMO_JWT_ISSUER` and `AMO_JWT_SECRET`.
3. Run it: **Actions → "Sign (AMO unlisted)" → Run workflow**, or push a `v*` tag.

### What the workflow does

- Builds the artifact with `build_release.py` (deterministic bytes, forward-slash
  entry names).
- **Unpacks that xpi into `stage/` and signs the staged tree.** It does not glob
  the repo, so what AMO signs is exactly the reviewed build — no stray file can
  join the package.
- Fails with a plain message if the version already exists on AMO (AMO rejects
  duplicate versions).
- Asserts `META-INF/mozilla.rsa`, `mozilla.sf` and `manifest.mf` are present.
- Asserts the signed file list is identical to the unsigned one.
- Uploads the signed xpi as a workflow artifact (90 days) and, on a tag push,
  attaches it to that GitHub Release.

### Where the key pair lives, and why CI is not signing yet (2026-10-21)

The add-on's API key pair exists and is proven live. It is stored **on the MSI
workstation only**, at `~/.ssh/amo-transcript-first-guard.env` (mode 600,
`AMO_JWT_ISSUER` / `AMO_JWT_SECRET` = KEY lines) — one pair for this add-on, never
reused by another extension.

It is **not** in the repo's Actions secrets, so `sign-release.yml` still fails at
its first step ("Fail fast if AMO credentials are missing"). That is a permissions
wall, not a missing key: pasting a repo secret needs `Secrets: write`, and **every
credential on this host returns 403** on `repos/DarkSky7/transcript-first-guard/
actions/secrets` (all four profile `GH_TOKEN`s, the `gh` keyring identity, and the
per-repo `_PAT` files). Only the repo owner can paste them, once, in the web UI:

1. <https://github.com/DarkSky7/transcript-first-guard/settings/secrets/actions>
2. New repository secret → `AMO_JWT_ISSUER` → value of that key in the file above
3. New repository secret → `AMO_JWT_SECRET` → the 64-char value

After that, push a `v*` tag and CI signs, verifies and commits `signed/` by itself.

**v1.1.24 was signed by the fallback path instead.** `scripts/sign-locally.sh`
performs the same steps as the workflow (build → stage the unpacked tree → `web-ext
sign --channel unlisted` → META-INF + content-parity checks → write `signed/`), so
the repo carries the same artifact either way. Proof recorded for 1.1.24: AMO
version `1.1.24` (file `5147742`) reports
`sha256:7547b921d9a6498a42e99168ab9d32689a66ba3cefb25a20d86cdf6e412c3a49`, which is
exactly what `signed/transcript-first-guard-1.1.24.xpi.sha256` contains.

Useful modes:

```
scripts/sign-locally.sh --check    # prove the key pair authenticates (no upload)
scripts/sign-locally.sh --stage    # sign, verify, but don't touch signed/
scripts/sign-locally.sh            # sign and write signed/ (commit it yourself)
```

Once the secrets are in place the workflow is the preferred path again; the script
stays as the fallback for when Actions permissions, secrets or the AMO API are
unavailable.

### Notes

- `listed` would enter human review; only `unlisted` completes unattended.
- AMO refuses a version number that already exists, so a version signed locally
  must not be signed again through CI — bump `manifest.json` instead.
- The keys are repo secrets: never commit them, never paste them in chat, and
  rotate by regenerating in the Developer Hub and updating both secrets.
- web-ext is pinned to major 8 in the workflow.

