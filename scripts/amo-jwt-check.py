#!/usr/bin/env python3
"""Prove the AMO JWT pair in the environment actually authenticates.

Reads AMO_JWT_ISSUER / AMO_JWT_SECRET from the process environment (never from
argv, so the secret never appears in a process listing) and calls AMO's
accounts/profile endpoint, which is free of side effects: nothing is uploaded,
no version is created.

Exit 0 = the key pair is accepted; exit 1 = rejected or missing.
Used by scripts/sign-locally.sh --check.
"""
import base64
import hashlib
import hmac
import json
import os
import sys
import time
import urllib.error
import urllib.request

iss = os.environ.get("AMO_JWT_ISSUER", "")
sec = os.environ.get("AMO_JWT_SECRET", "")
if not iss or not sec:
    print("ERROR: AMO_JWT_ISSUER / AMO_JWT_SECRET not in the environment", file=sys.stderr)
    raise SystemExit(2)


def b64(b: bytes) -> bytes:
    return base64.urlsafe_b64encode(b).rstrip(b"=")


stamp = time.time()
now = int(stamp)
head = b64(json.dumps({"alg": "HS256", "typ": "JWT"}, separators=(",", ":")).encode())
body = b64(json.dumps({"iss": iss, "jti": str(stamp), "iat": now, "exp": now + 300},
                      separators=(",", ":")).encode())
sig = b64(hmac.new(sec.encode(), head + b"." + body, hashlib.sha256).digest())
token = (head + b"." + body + b"." + sig).decode()

req = urllib.request.Request(
    "https://addons.mozilla.org/api/v5/accounts/profile/",
    headers={"Authorization": "JWT " + token, "User-Agent": "sign-locally-check"},
)
try:
    with urllib.request.urlopen(req, timeout=60) as resp:
        who = json.load(resp)
except urllib.error.HTTPError as e:
    print("JWT REJECTED:", e.code, e.read(300).decode("utf-8", "replace"), file=sys.stderr)
    raise SystemExit(1)
except Exception as e:  # network trouble is not a credential verdict
    print("probe failed:", e, file=sys.stderr)
    raise SystemExit(2)

print(f"JWT accepted; AMO account: {who.get('name')} (id {who.get('id')})")
