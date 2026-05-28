#!/usr/bin/env bash
# SpendOS — tek komutla tüm servisleri başlat
set -e

ROOT="$(cd "$(dirname "$0")" && pwd)"
FRONTEND_PORT=4180
PROXY_PORT=4191
X402_PORT=4192

cleanup() {
  echo ""
  echo "[SpendOS] Servisler durduruluyor..."
  kill "$PROXY_PID" 2>/dev/null || true
  kill "$X402_PID" 2>/dev/null || true
  kill "$FRONTEND_PID" 2>/dev/null || true
  exit 0
}
trap cleanup INT TERM

# .env.local varsa yükle
if [ -f "$ROOT/.env.local" ]; then
  set -a
  # shellcheck source=/dev/null
  source "$ROOT/.env.local"
  set +a
  echo "[SpendOS] .env.local yüklendi"
fi

# Mevcut port kullanıcılarını temizle (soft kill — force değil)
for port in $FRONTEND_PORT $PROXY_PORT $X402_PORT; do
  pids=$(lsof -ti :"$port" 2>/dev/null || true)
  if [ -n "$pids" ]; then
    echo "[SpendOS] Port $port temizleniyor (PID: $pids)"
    echo "$pids" | xargs kill 2>/dev/null || true
    sleep 1
  fi
done

# Proxy backend başlat
echo "[SpendOS] Proxy başlatılıyor → http://127.0.0.1:$PROXY_PORT"
/Users/frank/.nvm/versions/node/v22.22.2/bin/node "$ROOT/backend/spendos-proxy.mjs" &
PROXY_PID=$!

# x402 API server başlat
echo "[SpendOS] x402 API başlatılıyor → http://127.0.0.1:$X402_PORT"
/Users/frank/.nvm/versions/node/v22.22.2/bin/node "$ROOT/backend/x402-api-server.mjs" &
X402_PID=$!

# Frontend başlat
echo "[SpendOS] Frontend başlatılıyor → http://127.0.0.1:$FRONTEND_PORT"
python3 -m http.server $FRONTEND_PORT --directory "$ROOT" --bind 127.0.0.1 &
FRONTEND_PID=$!

# Servisler ayağa kalksın
sleep 1

# Vault durumunu göster (vault adresi varsa)
if [ -n "$SPENDOS_VAULT_ADDRESS" ] && [ "$SPENDOS_VAULT_ADDRESS" != "" ]; then
  echo "[SpendOS] Vault: $SPENDOS_VAULT_ADDRESS"
else
  echo "[SpendOS] Vault: henüz deploy edilmedi — demo modu aktif"
fi

echo ""
echo "┌─────────────────────────────────────────────────────┐"
echo "│  SpendOS                                            │"
echo "│  Frontend  →  http://127.0.0.1:$FRONTEND_PORT             │"
echo "│  Proxy API →  http://127.0.0.1:$PROXY_PORT             │"
echo "│  x402 API  →  http://127.0.0.1:$X402_PORT             │"
echo "│  Ctrl+C ile durdur                                  │"
echo "└─────────────────────────────────────────────────────┘"
echo ""

wait
