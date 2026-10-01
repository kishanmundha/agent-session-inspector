#!/usr/bin/env bash
# Build the standalone server and pack it into dist/agent-session-visualizer.tar.gz,
# the archive install.sh downloads. The build has no native modules, so one
# archive runs on any OS with Node.
set -euo pipefail

NAME=agent-session-visualizer
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VERSION="${1:-$(node -p "require('$ROOT/package.json').version")}"
VERSION="${VERSION#v}"
OUT="$ROOT/dist"
STAGE="$OUT/$NAME"

cd "$ROOT"
# Clear the old output first, or the build traces it into the new one.
rm -rf "$OUT"
pnpm run build

mkdir -p "$STAGE"

# next build leaves public/ and .next/static out of the standalone folder.
cp -R .next/standalone/. "$STAGE/"
cp -R public "$STAGE/public"
mkdir -p "$STAGE/.next"
cp -R .next/static "$STAGE/.next/static"

mkdir -p "$STAGE/bin"
cp "bin/$NAME.mjs" "$STAGE/bin/$NAME.mjs"
chmod +x "$STAGE/bin/$NAME.mjs"
echo "$VERSION" > "$STAGE/VERSION"

# The tracer drags in sharp's per-platform binaries (unused: images are
# unoptimized) and the odd repo dotfile. Drop them so the archive stays portable.
rm -rf "$STAGE/.claude" "$STAGE"/node_modules/.pnpm/@img+* "$STAGE"/node_modules/.pnpm/sharp@*
find "$STAGE" -type l ! -exec test -e {} \; -delete
if find "$STAGE" -name '*.node' | grep -q .; then
	echo "error: native module in build; the archive would not be portable:" >&2
	find "$STAGE" -name '*.node' >&2
	exit 1
fi

tar -czf "$OUT/$NAME.tar.gz" -C "$OUT" "$NAME"
cp install.sh "$OUT/install.sh"

echo "Packed $NAME $VERSION -> dist/$NAME.tar.gz ($(du -h "$OUT/$NAME.tar.gz" | cut -f1))"
