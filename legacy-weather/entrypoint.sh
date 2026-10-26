#!/bin/sh
set -e

TOKEN="${SESSION_TOKEN:-${LEGACY_WEATHER_TOKEN:-${TACS_TOKEN:-}}}"

if [ -n "$TOKEN" ]; then
  mkdir -p /root/.config/tacs /root/.tacs /app/.tacs

  case "$TOKEN" in
    \{*)
      # Token estructurado en formato JSON
      echo "$TOKEN" > /root/.config/tacs/token.json
      echo "$TOKEN" > /root/.tacs/session.token
      echo "$TOKEN" > /app/session.token
      ;;
    *)
      # Token en formato de texto plano o Bearer
      cat <<EOF > /root/.config/tacs/token.json
{
  "access_token": "$TOKEN",
  "token_type": "Bearer",
  "refresh_token": "$TOKEN",
  "expiry": "2030-01-01T00:00:00Z"
}
EOF
      echo "$TOKEN" > /root/.tacs/session.token
      echo "$TOKEN" > /app/.tacs/session.token
      echo "$TOKEN" > /app/session.token
      ;;
  esac
fi

if [ "$1" = "sh" ] || [ "$1" = "/bin/sh" ]; then
  exec "$@"
fi

exec /app/tacs-linux-amd64 "$@"
