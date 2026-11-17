#!/bin/sh
set -e

PORT="${PORT:-8080}"

mkdir -p /root/.config/tacs

SESSION_FILE=/root/.config/tacs/token.json

# Compose mounts the existing session directly; Render provides a secret file.
if [ -s "$SESSION_FILE" ]; then
    echo "Sesión OAuth montada correctamente."
elif [ -s /etc/secrets/token.json ]; then
    cp /etc/secrets/token.json "$SESSION_FILE"
    echo "Sesión OAuth copiada desde el archivo de secretos."
else
    echo "ERROR: Falta token.json. Generá una sesión institucional y montala en $SESSION_FILE."
    exit 1
fi

socat "TCP-LISTEN:${PORT},bind=0.0.0.0,fork,reuseaddr" TCP:127.0.0.1:9977 &

exec /app/tacs-linux-amd64 "$@"
