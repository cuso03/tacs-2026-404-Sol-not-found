#!/usr/bin/env bash
set -euo pipefail

case "${1:-}" in
  refs/heads/dev) printf '%s\n' develop ;;
  refs/heads/main) printf '%s\n' prod ;;
  *) printf '%s\n' 'Sólo las ramas dev y main pueden publicar.' >&2; exit 1 ;;
esac
