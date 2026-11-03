#!/bin/sh
set -e

PORT="${PORT:-10000}"

mkdir -p /root/.config/tacs

if [ ! -s /etc/secrets/token.json ]; then
    echo "ERROR: No se encontró /etc/secrets/token.json"
    exit 1
fi

cp /etc/secrets/token.json /root/.config/tacs/token.json

echo "Token OAuth encontrado y copiado correctamente."

socat "TCP-LISTEN:${PORT},bind=0.0.0.0,fork,reuseaddr" TCP:127.0.0.1:9977 &

exec /app/tacs-linux-amd64 "$@"
