# ─────────────────────────────────────────────────────────────
# Hooklab API — Deno on Cloud Run
# ─────────────────────────────────────────────────────────────
FROM denoland/deno:alpine-2.1.4

WORKDIR /app

# Copy dependency manifests first for cache-friendly layers
COPY deno.json deno.lock* ./
COPY server/deno.json ./server/

# Cache dependencies
RUN deno install --entrypoint server/main.ts || true

# Copy server source
COPY server/ ./server/

# Cloud Run injects PORT (default 8080)
ENV PORT=8080
EXPOSE 8080

# Run with minimal permissions — restrict file reads to the app directory only
USER deno
CMD ["deno", "run", \
     "--allow-net", \
     "--allow-env=PORT,JWT_SECRET,DENO_ENV,ALLOWED_ORIGINS,K_SERVICE", \
     "--allow-read=/app/server", \
     "--unstable-worker-options", \
     "server/main.ts"]
