```sh
#!/bin/sh
set -e

PORT="${PORT:-10000}"

# Preparar la ubicación esperada por el binario.
mkdir -p /root/.config/tacs

# Copiar el Secret File de Render.
if [ ! -s /etc/secrets/token.json ]; then
    echo "ERROR: No se encontró /etc/secrets/token.json"
    exit 1
fi

cp /etc/secrets/token.json /root/.config/tacs/token.json

echo "Token OAuth encontrado y copiado correctamente."

# Exponer el puerto del binario a Render.
socat "TCP-LISTEN:${PORT},bind=0.0.0.0,fork,reuseaddr" TCP:127.0.0.1:9977 &

# Iniciar el binario.
exec /app/tacs-linux-amd64 "$@"
```
