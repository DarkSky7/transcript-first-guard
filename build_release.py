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
build_unpacked(os.path.join("dist", f"chrome-{_ver}"))
