#!/usr/bin/env bash
set -euo pipefail

NAME=agent-session-inspector

docker build -t "$NAME" .

if docker container inspect "$NAME" >/dev/null 2>&1; then
	docker rm -f "$NAME"
fi

# Mount only the transcript paths the app reads, read-only. Deliberately narrow:
# ~/.codex/auth.json, ~/.copilot/config.json and ~/.hermes/auth.json hold
# credentials and stay out.
PATHS=(
	".copilot/session-state"
	".copilot/logs"
	".copilot/session-store.db"
	".copilot/session-store.db-shm"
	".copilot/session-store.db-wal"
	".claude/projects"
	".codex/sessions"
	".codex/session_index.jsonl"
	".local/share/opencode/opencode.db"
	".local/share/opencode/opencode.db-shm"
	".local/share/opencode/opencode.db-wal"
	".hermes/state.db"
	".hermes/state.db-shm"
	".hermes/state.db-wal"
)

# Desktop apps keep their data somewhere else on each OS; inside the Linux
# container the app looks under ~/.config.
case "$(uname -s)" in
Darwin) APP_DATA="Library/Application Support" ;;
*) APP_DATA=".config" ;;
esac
APP_PATHS=(
	"Code/User/workspaceStorage"
	"Code/User/globalStorage/emptyWindowChatSessions"
	"Code - Insiders/User/workspaceStorage"
	"Code - Insiders/User/globalStorage/emptyWindowChatSessions"
	"Claude/local-agent-mode-sessions"
)

mounts=()
for rel in "${PATHS[@]}"; do
	if [ -e "$HOME/$rel" ]; then
		mounts+=(-v "$HOME/$rel:/root/$rel:ro")
	fi
done
for rel in "${APP_PATHS[@]}"; do
	if [ -e "$HOME/$APP_DATA/$rel" ]; then
		mounts+=(-v "$HOME/$APP_DATA/$rel:/root/.config/$rel:ro")
	fi
done

if [ ${#mounts[@]} -eq 0 ]; then
	echo "No agent session directories found under $HOME." >&2
	exit 1
fi

# The app shows where each session is stored; tell it what the mounts are
# called out here, so the paths it shows are ones that exist on this machine.
docker run -d --name "$NAME" --restart unless-stopped --user root -e HOME=/root \
	-e ASI_HOST_HOME="$HOME" -e ASI_HOST_APP_DATA="$HOME/$APP_DATA" \
	"${mounts[@]}" "$NAME"
