#!/usr/bin/env python3
"""Reproducible release build for Transcript-First & Live Chat Guard.

Creates byte-identical youtube-transcript-guard.zip and
transcript-first-guard.xpi from repo-root files, using FORWARD-SLASH
entry names (backslashes are rejected by AMO/Chrome: "Invalid file
name in archive"). Fixed timestamp => deterministic bytes.

Usage: uv run python build_release.py   (from repo root)
"""
import hashlib
import os
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
