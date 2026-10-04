#!/usr/bin/env bash
# Build the standalone server and stage it in dist/agent-session-inspector, the
# folder `npm publish` uploads, then pack that into
# dist/agent-session-inspector.tar.gz, the archive install.sh downloads. The
# build has no native modules, so one package runs on any OS with Node.
set -euo pipefail

NAME=agent-session-inspector
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VERSION="${1:-$(node -p "require('$ROOT/package.json').version")}"
VERSION="${VERSION#v}"
OUT="$ROOT/dist"
STAGE="$OUT/$NAME"
# The server sits a level down: npm leaves a package's top-level node_modules
# out of the upload.
APP="$STAGE/app"
MODULES="$APP/node_modules"

cd "$ROOT"
# Clear the old output first, or the build traces it into the new one.
rm -rf "$OUT"
pnpm run build

mkdir -p "$APP"

# next build leaves .next/static out of the standalone folder.
cp -R .next/standalone/. "$APP/"
mkdir -p "$APP/.next"
cp -R .next/static "$APP/.next/static"

mkdir -p "$STAGE/bin"
cp "bin/$NAME.mjs" "$STAGE/bin/$NAME.mjs"
chmod +x "$STAGE/bin/$NAME.mjs"
echo "$VERSION" > "$STAGE/VERSION"
cp README.md LICENSE "$STAGE/"

# The tracer drags in sharp (unused: images are unoptimized) with its
# per-platform binaries and dependencies.
for dep in "$MODULES"/.pnpm/sharp@*/node_modules/*; do
	if [ -L "$dep" ]; then
		target="$(cd "$dep" 2>/dev/null && pwd -P)" || continue
		rm -rf "${target%/node_modules/*}"
	fi
done
rm -rf "$MODULES"/.pnpm/@img+* "$MODULES"/.pnpm/sharp@*

# npm never uploads symlinks, and pnpm's node_modules is built from them, so
# hoist every traced package into one flat node_modules.
find "$APP" -type l -delete
for dir in "$MODULES"/.pnpm/*/node_modules/* "$MODULES"/.pnpm/*/node_modules/@*/*; do
	[ -d "$dir" ] || continue
	name="${dir##*/node_modules/}"
	case "$name" in @*/*) ;; @*) continue ;; esac
	if [ -e "$MODULES/$name" ]; then
		echo "error: two versions of $name in the build; a flat node_modules can hold one" >&2
		exit 1
	fi
	mkdir -p "$(dirname "$MODULES/$name")"
	mv "$dir" "$MODULES/$name"
done
rm -rf "$MODULES/.pnpm"

if find "$STAGE" -name '*.node' | grep -q .; then
	echo "error: native module in build; the package would not be portable:" >&2
	find "$STAGE" -name '*.node' >&2
	exit 1
fi

# The manifest npm publishes: the built app has no dependencies left to install.
node -e '
	const pkg = require(process.argv[1]);
	const [name, version] = process.argv.slice(2);
	const { description, keywords, author, license, homepage, bugs, repository, engines } = pkg;
	console.log(JSON.stringify({
		name, version, description, keywords, author, license, homepage, bugs, repository, engines,
		bin: { [name]: `bin/${name}.mjs` },
		files: ["app", "bin", "VERSION"],
	}, null, 2));
' "$ROOT/package.json" "$NAME" "$VERSION" > "$STAGE/package.json"

tar -czf "$OUT/$NAME.tar.gz" -C "$OUT" "$NAME"
cp install.sh "$OUT/install.sh"

echo "Packed $NAME $VERSION -> dist/$NAME.tar.gz ($(du -h "$OUT/$NAME.tar.gz" | cut -f1))"
