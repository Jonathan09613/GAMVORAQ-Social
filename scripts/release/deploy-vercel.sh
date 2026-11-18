#!/usr/bin/env bash
# Ejecutar solo tras aprobar el despliegue de produccion en GitHub Actions.
set -euo pipefail
: "${VERCEL_TOKEN:?Falta VERCEL_TOKEN en GitHub Secrets}"
: "${VERCEL_ORG_ID:?Falta VERCEL_ORG_ID en GitHub Secrets}"
: "${VERCEL_PROJECT_ID:?Falta VERCEL_PROJECT_ID en GitHub Secrets}"

npx --yes vercel@latest pull --yes --environment=production --token="$VERCEL_TOKEN"
npx --yes vercel@latest build --prod --token="$VERCEL_TOKEN"
DEPLOY_URL="$(npx --yes vercel@latest deploy --prebuilt --prod --yes --token="$VERCEL_TOKEN" | tail -n 1)"
if [[ "$DEPLOY_URL" != https://* ]]; then
  echo 'No se pudo obtener una URL HTTPS valida desde Vercel' >&2
  exit 1
fi
printf 'URL del despliegue: %s\n' "$DEPLOY_URL"
node scripts/release/smoke-http.mjs "$DEPLOY_URL"
