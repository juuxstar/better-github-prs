#!/usr/bin/env sh
set -eu

APP_NAME="${APP_NAME:-prism}"
IMAGE_TAG="${IMAGE_TAG:-latest}"
TARGET_PLATFORM="${TARGET_PLATFORM:-linux/amd64}"
LOCAL_IMAGE="${APP_NAME}:${IMAGE_TAG}"
CONTAINER_NAME="${CONTAINER_NAME:-$APP_NAME}"
HOST_PORT="${HOST_PORT:-3002}"
CONTAINER_PORT="${CONTAINER_PORT:-3002}"
REMOTE_APP_DIR="${REMOTE_APP_DIR:-/home/ubuntu/frontlobby/prism}"
REMOTE_IMAGE_TAR="${REMOTE_IMAGE_TAR:-${REMOTE_APP_DIR}/${APP_NAME}-${IMAGE_TAG}.tar.gz}"
REMOTE_USE_SUDO_SU="${REMOTE_USE_SUDO_SU:-0}"
SSH_REMOTE_OPTS="-T -o RemoteCommand=none -o RequestTTY=no -o ClearAllForwardings=yes"

if [ "$#" -ne 1 ]; then
	echo "Usage: GITHUB_CLIENT_ID=your-client-id $0 user@server"
	exit 1
fi

if [ -z "${GITHUB_CLIENT_ID:-}" ]; then
	echo "GITHUB_CLIENT_ID is required."
	exit 1
fi

SSH_TARGET="$1"
LOCAL_IMAGE_TAR="$(mktemp -t "${APP_NAME}-${IMAGE_TAG}.XXXXXX.tar.gz")"

shell_quote() {
	printf "'%s'" "$(printf "%s" "$1" | sed "s/'/'\\\\''/g")"
}

cleanup() {
	rm -f "$LOCAL_IMAGE_TAR"
}
trap cleanup EXIT

echo "Building $LOCAL_IMAGE for $TARGET_PLATFORM..."
docker build --platform "$TARGET_PLATFORM" -t "$LOCAL_IMAGE" .

echo "Saving $LOCAL_IMAGE to $LOCAL_IMAGE_TAR..."
docker save "$LOCAL_IMAGE" | gzip > "$LOCAL_IMAGE_TAR"

echo "Preparing $SSH_TARGET:$REMOTE_APP_DIR..."
ssh $SSH_REMOTE_OPTS "$SSH_TARGET" "mkdir -p $(shell_quote "$REMOTE_APP_DIR")"

echo "Uploading image archive to $SSH_TARGET:$REMOTE_IMAGE_TAR..."
scp "$LOCAL_IMAGE_TAR" "$SSH_TARGET:$REMOTE_IMAGE_TAR"

echo "Loading and restarting $CONTAINER_NAME on $SSH_TARGET..."
REMOTE_ENV="LOCAL_IMAGE=$(shell_quote "$LOCAL_IMAGE")"
REMOTE_ENV="$REMOTE_ENV CONTAINER_NAME=$(shell_quote "$CONTAINER_NAME")"
REMOTE_ENV="$REMOTE_ENV HOST_PORT=$(shell_quote "$HOST_PORT")"
REMOTE_ENV="$REMOTE_ENV CONTAINER_PORT=$(shell_quote "$CONTAINER_PORT")"
REMOTE_ENV="$REMOTE_ENV REMOTE_APP_DIR=$(shell_quote "$REMOTE_APP_DIR")"
REMOTE_ENV="$REMOTE_ENV REMOTE_IMAGE_TAR=$(shell_quote "$REMOTE_IMAGE_TAR")"
REMOTE_ENV="$REMOTE_ENV GITHUB_CLIENT_ID=$(shell_quote "$GITHUB_CLIENT_ID")"

REMOTE_COMMAND="$REMOTE_ENV sh -s"
if [ "$REMOTE_USE_SUDO_SU" = "1" ]; then
	REMOTE_COMMAND="sudo -E env $REMOTE_ENV sh -s"
fi

ssh $SSH_REMOTE_OPTS "$SSH_TARGET" "$REMOTE_COMMAND" <<'REMOTE_SCRIPT'
set -eu

docker_cmd() {
	if [ "${REMOTE_DOCKER_USE_SUDO:-0}" = "1" ]; then
		sudo -E docker "$@"
	else
		docker "$@"
	fi
}

cd "$REMOTE_APP_DIR"
if ! docker ps >/dev/null 2>&1; then
	if sudo -n -E docker ps >/dev/null 2>&1; then
		REMOTE_DOCKER_USE_SUDO=1
	else
		echo "Docker is not available to this user, and sudo docker is not available without a password." >&2
		exit 1
	fi
fi

docker_cmd load < "$REMOTE_IMAGE_TAR"
docker_cmd rm -f "$CONTAINER_NAME" >/dev/null 2>&1 || true
docker_cmd run -d \
	--name "$CONTAINER_NAME" \
	--restart unless-stopped \
	-p "$HOST_PORT:$CONTAINER_PORT" \
	-e "GITHUB_CLIENT_ID=$GITHUB_CLIENT_ID" \
	"$LOCAL_IMAGE"
rm -f "$REMOTE_IMAGE_TAR"
REMOTE_SCRIPT

echo "Deployed $LOCAL_IMAGE to $SSH_TARGET on port $HOST_PORT."
