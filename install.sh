#!/usr/bin/env bash
# Installer for Agent Session Visualizer.
#
#   curl -fsSL https://github.com/kishanmundha/agent-session-visualizer/releases/latest/download/install.sh | bash
#
# Downloads the prebuilt app from GitHub Releases into ~/.agent-session-visualizer
# and links an `agent-session-visualizer` command into ~/.local/bin. Re-run to update.
#
# Environment overrides:
#   ASV_VERSION      release tag to install, e.g. v0.2.0 (default: latest)
#   ASV_HOME         install directory (default: ~/.agent-session-visualizer)
#   ASV_BIN_DIR      where to link the command (default: ~/.local/bin)
#   ASV_TARBALL_URL  download this archive instead of a GitHub release
set -euo pipefail

NAME=agent-session-visualizer
REPO=kishanmundha/agent-session-visualizer
MIN_NODE=22.13.0

INSTALL_DIR="${ASV_HOME:-$HOME/.$NAME}"
BIN_DIR="${ASV_BIN_DIR:-$HOME/.local/bin}"
VERSION="${ASV_VERSION:-latest}"

info() { printf '\033[1;34m==>\033[0m %s\n' "$*"; }
die() {
	printf '\033[1;31merror:\033[0m %s\n' "$*" >&2
	exit 1
}

# Wrapped in a function so a truncated download can't run half a script.
main() {
	command -v tar >/dev/null 2>&1 || die "tar is required."
	command -v curl >/dev/null 2>&1 || die "curl is required."
	command -v node >/dev/null 2>&1 ||
		die "Node.js $MIN_NODE or newer is required. Install it from https://nodejs.org and re-run."

	node -e '
		const want = process.argv[1].split(".").map(Number);
		const have = process.versions.node.split(".").map(Number);
		for (let i = 0; i < 3; i++) {
			if (have[i] !== want[i]) process.exit(have[i] > want[i] ? 0 : 1);
		}
	' "$MIN_NODE" || die "Node.js $MIN_NODE or newer is required (found $(node -v))."

	local url
	if [ -n "${ASV_TARBALL_URL:-}" ]; then
		url="$ASV_TARBALL_URL"
	elif [ "$VERSION" = latest ]; then
		url="https://github.com/$REPO/releases/latest/download/$NAME.tar.gz"
	else
		url="https://github.com/$REPO/releases/download/$VERSION/$NAME.tar.gz"
	fi

	tmp="$(mktemp -d)"
	trap 'rm -rf "$tmp"' EXIT

	info "Downloading $url"
	curl -fsSL "$url" -o "$tmp/$NAME.tar.gz" || die "Download failed: $url"
	tar -xzf "$tmp/$NAME.tar.gz" -C "$tmp"
	[ -f "$tmp/$NAME/server.js" ] || die "Downloaded archive is not a $NAME build."

	# Swap the new build in only once it is fully extracted.
	info "Installing to $INSTALL_DIR"
	mkdir -p "$INSTALL_DIR" "$BIN_DIR"
	rm -rf "$INSTALL_DIR/app"
	mv "$tmp/$NAME" "$INSTALL_DIR/app"
	ln -sf "$INSTALL_DIR/app/bin/$NAME.mjs" "$BIN_DIR/$NAME"

	info "Installed $NAME $(cat "$INSTALL_DIR/app/VERSION" 2>/dev/null || echo)"
	echo
	case ":$PATH:" in
	*":$BIN_DIR:"*)
		echo "Run it with:  $NAME"
		;;
	*)
		echo "$BIN_DIR is not on your PATH. Add it:"
		echo
		echo "  export PATH=\"$BIN_DIR:\$PATH\""
		echo
		echo "or run it directly:  $BIN_DIR/$NAME"
		;;
	esac
}

main "$@"
