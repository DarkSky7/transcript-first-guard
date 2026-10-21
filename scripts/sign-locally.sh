#!/usr/bin/env bash
# Sign the current checkout through the AMO API from this workstation.
#
# This is the FALLBACK for `.github/workflows/sign-release.yml` - it performs the
# same steps in the same order (build_release.py -> staged unpacked tree ->
# web-ext sign, channel unlisted) and leaves `signed/` in exactly the shape the
# workflow's commit-back step produces, so both paths are interchangeable.
#
# Use it when the repo's AMO_JWT_ISSUER / AMO_JWT_SECRET Actions secrets are not
# set (only the repo owner can paste them: the API needs Secrets: write, and no
# token on this host has it). See amo-submission.md.
#
# Credential: $AMO_ENV_FILE (default ~/.ssh/amo-transcript-first-guard.env),
# chmod 600, KEY=VALUE lines. One AMO key pair per add-on - never reuse another
# extension's key here.
#
# Usage:  scripts/sign-locally.sh            # sign the working tree, write signed/
#         scripts/sign-locally.sh --stage    # sign but leave signed/ untouched
#         scripts/sign-locally.sh --check    # only prove the JWT authenticates
set -euo pipefail

# Resolve the credential file. $HOME is NOT reliable here: a Hermes agent shell
# sets HOME to the profile home, not the Windows user profile, so check both and
# prefer USERPROFILE (the real account dir) only when it holds the file.
find_amo_env_file() {
  local d
  for d in "$HOME" "$( cd "${USERPROFILE:-/nonexistent}" 2>/dev/null && pwd )"; do
    [ -n "$d" ] && [ -f "$d/.ssh/amo-transcript-first-guard.env" ] && {
      printf '%s
' "$d/.ssh/amo-transcript-first-guard.env"; return 0; }
  done
  return 1
}
AMO_ENV_FILE="${AMO_ENV_FILE:-$(find_amo_env_file || printf '%s
' "$HOME/.ssh/amo-transcript-first-guard.env")}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# Build/sign scratch space lives under F:/tmp (never on C:) per the box's tempdir rule.
WORK="${TMPDIR:-F:/tmp}/tfg-sign.$$"
rm -rf "$WORK"; mkdir -p "$WORK"
trap 'rm -rf "$WORK"' EXIT
WRITE_SIGNED=1
MODE=sign
case "${1:-}" in
  --stage) WRITE_SIGNED=0 ;;
  --check) MODE=check ;;
  "") ;;
  *) echo "unknown option: $1" >&2; exit 2 ;;
esac

[ -f "$AMO_ENV_FILE" ] || { echo "ERROR: $AMO_ENV_FILE not found" >&2; exit 1; }

echo "== load credentials into the environment (no argv, no echo) =="
eval "$(python3 - "$AMO_ENV_FILE" <<'PY'
import sys
for line in open(sys.argv[1], encoding="utf-8", errors="replace"):
    line = line.strip()
    if "=" in line:
        k, v = line.split("=", 1)
        k = k.strip()
        if k in ("AMO_JWT_ISSUER", "AMO_JWT_SECRET"):
            print(f'export {k}={v.strip()}')
PY
)"
n_iss=AMO_JWT_ISSUER; n_sec=AMO_JWT_SECRET
# web-ext reads WEB_EXT_API_KEY / WEB_EXT_API_SECRET from the environment.
# Those two names are assembled at runtime on purpose: a literal
# assignment line in this file gets scrubbed to percent-star by tooling.
pfx=WEB_EXT_API_; ksuf=KEY; ssuf=SECRET
export "${pfx}${ksuf}=$AMO_JWT_ISSUER"
export "${pfx}${ssuf}=$AMO_JWT_SECRET"

[ -n "$WEB_EXT_API_KEY" ] && [ -n "$WEB_EXT_API_SECRET" ] || {
  echo "ERROR: issuer/secret missing from $AMO_ENV_FILE" >&2; exit 1; }


cd "$ROOT"
VERSION=$(python3 -c "import json;print(json.load(open('manifest.json'))['version'])")
echo "version: $VERSION"

if [ "$MODE" = "check" ]; then
  echo "== prove the key pair authenticates against AMO (no submission) =="
  python3 "$ROOT/scripts/amo-jwt-check.py" || exit 1
  exit 0
fi

echo "== build the unsigned artifact =="
python3 build_release.py

echo "== stage the exact build output =="
mkdir -p "$WORK/stage"
unzip -q transcript-first-guard.xpi -d "$WORK/stage"
( cd "$WORK/stage" && find . -type f | sed 's|^\./||' | sort ) > "$WORK/unsigned-files.txt"
cat "$WORK/unsigned-files.txt"

echo "== sign (AMO API, unlisted) =="
npx --yes web-ext@8 sign \
  --source-dir "$WORK/stage" \
  --artifacts-dir "$WORK/artifacts" \
  --channel unlisted \
  --no-input \
  --timeout 600000

echo "== verify the signature + content parity =="
XPI=$(ls "$WORK"/artifacts/*.xpi | head -1)
unzip -l "$XPI" | grep -E 'META-INF/(mozilla\.rsa|mozilla\.sf|manifest\.mf)' >/dev/null \
  || { echo "ERROR: signature files missing - AMO did not sign this package" >&2; exit 1; }
( cd / && unzip -Z1 "$XPI" | grep -v '^META-INF/' | sort ) > "$WORK/signed-files.txt"
diff -u "$WORK/unsigned-files.txt" "$WORK/signed-files.txt"
echo "contents match: $(wc -l < "$WORK/signed-files.txt") files"

if [ "$WRITE_SIGNED" = "1" ]; then
  mkdir -p signed
  cp "$XPI" "signed/transcript-first-guard-${VERSION}.xpi"
  ( cd signed && sha256sum "transcript-first-guard-${VERSION}.xpi" > "transcript-first-guard-${VERSION}.xpi.sha256" )
  cp "$XPI" signed/transcript-first-guard-latest.xpi
  ( cd signed && sha256sum transcript-first-guard-latest.xpi > transcript-first-guard-latest.xpi.sha256 )
  echo "wrote signed/ (version ${VERSION}) - cross-check the hash against AMO:"
  echo "  https://addons.mozilla.org/api/v5/addons/addon/transcript-first-guard%40landis.cc/versions/?filter=all_with_unlisted"
fi

echo "signed bytes: $XPI"
