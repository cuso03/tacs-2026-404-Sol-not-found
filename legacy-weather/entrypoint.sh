#!/bin/sh
set -e

HOME_DIR="${HOME:-/root}"

if [ -n "$SESSION_TOKEN" ]; then
  mkdir -p "$HOME_DIR/.tacs"
  printf '%s' "$SESSION_TOKEN" > "$HOME_DIR/.tacs/session.token"
fi

exec /app/tacs-linux-amd64 "$@"
