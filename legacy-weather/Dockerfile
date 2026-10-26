FROM alpine:3.20

# Dependencias para certificados HTTPS y healthcheck
RUN apk add --no-cache curl ca-certificates tzdata

WORKDIR /app

# Copiar el binario compilado y entrypoint
COPY tacs-linux-amd64 /app/tacs-linux-amd64
COPY entrypoint.sh /app/entrypoint.sh

# Otorgar permisos de ejecución
RUN chmod +x /app/tacs-linux-amd64 /app/entrypoint.sh

# Puerto en el que escucha el servicio RPC y probes
EXPOSE 8080

# Healthcheck usando liveness probe /healthz
HEALTHCHECK --interval=10s --timeout=3s --retries=3 --start-period=5s \
  CMD curl -f http://localhost:8080/healthz || exit 1

# Iniciar el servicio legacy mediante entrypoint
ENTRYPOINT ["/app/entrypoint.sh"]
