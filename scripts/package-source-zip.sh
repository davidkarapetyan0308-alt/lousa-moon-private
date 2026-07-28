#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VERSION="$(node -p "require('$ROOT/package.json').version")"
VERSION_CODE="$(node -e "const fs=require('fs');const s=fs.readFileSync('$ROOT/android/app/build.gradle','utf8');const m=s.match(/versionCode\s+(\d+)/);if(!m)process.exit(1);process.stdout.write(m[1]);")"
NAME="LOUSA_MOON_V${VERSION}_BUILD${VERSION_CODE}_PAPER_MOON_NATIVE_HANDOFF_FIX_SOURCE"
OUTPUT="${1:-$(dirname "$ROOT")/${NAME}.zip}"

python3 - "$ROOT" "$OUTPUT" "$NAME" <<'PY'
import os, pathlib, stat, sys, zipfile
root = pathlib.Path(sys.argv[1]).resolve()
out = pathlib.Path(sys.argv[2]).resolve()
name = sys.argv[3]
out.parent.mkdir(parents=True, exist_ok=True)
blocked_dirs = {'.git', 'node_modules', '.gradle', '.expo', 'Pods', 'dist', 'dist_web', '__pycache__'}
blocked_exact = {
    pathlib.PurePosixPath('android/app/build'),
    pathlib.PurePosixPath('android/.gradle'),
    pathlib.PurePosixPath('ios/Pods'),
}
blocked_files = {'.env', '.env.qa', '.env.production', 'android/keystore.properties'}
blocked_suffixes = {'.apk', '.aab', '.jks', '.keystore', '.DS_Store'}

def excluded(rel: pathlib.PurePosixPath) -> bool:
    if str(rel) in blocked_files:
        return True
    if any(part in blocked_dirs for part in rel.parts):
        return True
    if any(rel == p or p in rel.parents for p in blocked_exact):
        return True
    if rel.suffix in blocked_suffixes:
        return True
    if rel.name.startswith('.env.') and not rel.name.endswith('.example'):
        return True
    return False

with zipfile.ZipFile(out, 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=9) as zf:
    for path in sorted(root.rglob('*')):
        rel = pathlib.PurePosixPath(path.relative_to(root).as_posix())
        if excluded(rel) or path.resolve() == out:
            continue
        arc = pathlib.PurePosixPath(name) / rel
        if path.is_dir():
            continue
        info = zipfile.ZipInfo.from_file(path, arc.as_posix())
        if os.access(path, os.X_OK):
            info.external_attr = (stat.S_IFREG | 0o755) << 16
        with path.open('rb') as src:
            zf.writestr(info, src.read(), compress_type=zipfile.ZIP_DEFLATED, compresslevel=9)
print(out)
PY

bash "$ROOT/scripts/verify-source-zip.sh" "$OUTPUT"

if command -v sha256sum >/dev/null 2>&1; then
  sha256sum "$OUTPUT" > "$OUTPUT.sha256"
else
  shasum -a 256 "$OUTPUT" > "$OUTPUT.sha256"
fi

echo "Source ZIP: $OUTPUT"
echo "SHA-256 file: $OUTPUT.sha256"
