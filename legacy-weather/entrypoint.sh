#!/bin/sh
set -e

# Reenviar el puerto público 8080 hacia el puerto 127.0.0.1:9977 donde escucha el binario legacy
socat TCP-LISTEN:8080,fork,reuseaddr TCP:127.0.0.1:9977 &

exec /app/tacs-linux-amd64 "$@"
