#!/usr/bin/env python3
"""Reproducible release build for Transcript-First & Live Chat Guard.

Creates byte-identical youtube-transcript-guard.zip and
transcript-first-guard.xpi from repo-root files, using FORWARD-SLASH
entry names (backslashes are rejected by AMO/Chrome: "Invalid file
name in archive"). Fixed timestamp => deterministic bytes.

Usage: uv run python build_release.py   (from repo root)
"""
import hashlib
import json
import os
import shutil
import zipfile

ROOT = os.path.dirname(os.path.abspath(__file__))
os.chdir(ROOT)

FIXED_TS = (2026, 8, 24, 0, 0, 0)

ENTRIES = [
    "icons/icon128.png",
    "icons/icon16.png",
    "icons/icon48.png",
    "content.css",
    "content.js",
    "manifest.json",
    "popup.html",
    "popup.js",
]


def build(path: str) -> None:
    with zipfile.ZipFile(path, "w", zipfile.ZIP_DEFLATED) as z:
        for name in ENTRIES:
            info = zipfile.ZipInfo(name, date_time=FIXED_TS)
            info.compress_type = zipfile.ZIP_DEFLATED
            with open(name, "rb") as f:
                z.writestr(info, f.read())


def md5(path: str) -> str:
    h = hashlib.md5()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(65536), b""):
            h.update(chunk)
    return h.hexdigest()


for p in ("youtube-transcript-guard.zip", "transcript-first-guard.xpi"):
    build(p)

a = md5("youtube-transcript-guard.zip")
b = md5("transcript-first-guard.xpi")
print("zip :", a)
print("xpi :", b)
print("identical:", a == b)


def build_unpacked(dest: str) -> None:
    """Chromium/Brave 'Load unpacked' tree.

    An archive cannot be loaded by Chromium — `brave://extensions` ->
    Developer mode -> Load unpacked needs a DIRECTORY whose root holds
    manifest.json. Same entries as the archive, but the Firefox-only
    top-level keys (browser_specific_settings, gecko_android) are dropped:
    Chromium ignores them and flags them as unrecognised manifest keys on
    the extension card, which reads like a defect.
    """
    if os.path.isdir(dest):
        shutil.rmtree(dest)
    for name in ENTRIES:
        out = os.path.join(dest, name.replace("/", os.sep))
        os.makedirs(os.path.dirname(out) or dest, exist_ok=True)
        shutil.copyfile(name, out)
    with open("manifest.json", "r", encoding="utf-8") as f:
        m = json.load(f)
    for k in ("browser_specific_settings", "gecko_android"):
        m.pop(k, None)
    with open(os.path.join(dest, "manifest.json"), "w", encoding="utf-8", newline="\n") as f:
        json.dump(m, f, indent=2, ensure_ascii=False)
        f.write("\n")
    n = sum(len(files) for _, _, files in os.walk(dest))
    print(f"unpacked -> {dest}  ({n} files, manifest {m['version']})")


with open("manifest.json", "r", encoding="utf-8") as f:
    _ver = json.load(f)["version"]

# ---------------------------------------------------------------------------
# Human-facing release layout. The point of this tree is that you pick your
# BROWSER first and never have to know what "signed" or "dist" mean:
#
#   dist/
#     README.md              <- which file for which browser
#     firefox/1.1.26.xpi     <- about:addons -> Install Add-on From File
#     chromium/1.1.26/       <- brave://extensions -> Load unpacked
#
# Everything under dist/ is derived, so it is gitignored; regenerate any time.
# The CI audit trail still lives in signed/ (committed, immutable, written by
# the signing workflow) and the workflow's own build output stays at the repo
# root — those are internals, not things a user should have to reason about.
# ---------------------------------------------------------------------------
DIST = "dist"
FF = os.path.join(DIST, "firefox")
CR = os.path.join(DIST, "chromium")

# Anything not in the documented layout is stale: old per-version unpacked
# dirs, and artifacts dumped at the dist/ root by earlier build scripts.
for entry in os.listdir(DIST) if os.path.isdir(DIST) else []:
    path = os.path.join(DIST, entry)
    stale_dir = entry.startswith("chrome-") and os.path.isdir(path)
    stale_file = entry.startswith("transcript-first-guard-") and entry.endswith((".xpi", ".zip"))
    if stale_dir:
        shutil.rmtree(path)
    elif stale_file:
        os.remove(path)

build_unpacked(os.path.join(CR, _ver))

signed_src = os.path.join("signed", f"transcript-first-guard-{_ver}.xpi")
os.makedirs(FF, exist_ok=True)
ff_dest = os.path.join(FF, f"{_ver}.xpi")
if os.path.isfile(signed_src):
    shutil.copyfile(signed_src, ff_dest)
    ff_note = f"signed (AMO unlisted), copied from signed/transcript-first-guard-{_ver}.xpi"
else:
    shutil.copyfile("transcript-first-guard.xpi", ff_dest)
    ff_note = "UNSIGNED build - Firefox/Zen will refuse it; push a v* tag to sign"

readme = f"""# Which file do I install?

Pick the **browser** you are installing into. Nothing else matters.

## Firefox / Zen / other Firefox forks

**File:** `firefox/{_ver}.xpi`

1. `about:addons`
2. Gear icon (top right) -> **Install Add-on From File...**
3. Choose `dist/firefox/{_ver}.xpi`

Status: {ff_note}

On Firefox 127+ host permissions are granted by the install prompt. If the
extension ends up with no site access anyway (sideloaded, or revoked), open the
extension's popup and use its **Enable on YouTube** button.

## Chromium: Chrome / Edge / Brave / Opera

**Folder:** `chromium/{_ver}/`

1. `chrome://extensions` (or `brave://extensions`, `edge://extensions`)
2. Turn on **Developer mode**
3. **Load unpacked** -> select the `chromium/{_ver}` **folder** (not a file)

Unpacked means unsigned, so Chromium will nag "Disable developer mode
extensions" at startup. Expected. Declared host permissions are granted on load.

## Do not cross them over

- `.xpi` into Chromium -> "Manifest file is missing or unreadable" (an XPI is a
  signed Mozilla package).
- An unpacked folder into Firefox -> not installable (there is no file to pick).

## Where these came from

| Path | What it is | Who writes it |
|---|---|---|
| `dist/` | this tree - derived, gitignored | `build_release.py` |
| `signed/` | signed XPIs + sha256, committed audit trail | signing workflow (tag push) |
| `transcript-first-guard.xpi` / `.zip` | unsigned reproducible build (byte-identical pair) | `build_release.py` |
"""
with open(os.path.join(DIST, "README.md"), "w", encoding="utf-8", newline="\n") as f:
    f.write(readme)
print(f"release tree -> {DIST}/ (firefox/{_ver}.xpi, chromium/{_ver}/, README.md)")
print(f"  firefox artifact: {ff_note}")

