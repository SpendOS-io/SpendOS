#!/usr/bin/env bash
# SpendOS — start all services with a single command
set -e

ROOT="$(cd "$(dirname "$0")" && pwd)"
FRONTEND_PORT=4180
PROXY_PORT=4191
X402_PORT=4192

cleanup() {
  echo ""
  echo "[SpendOS] Stopping services..."
  kill "$PROXY_PID" 2>/dev/null || true
  kill "$X402_PID" 2>/dev/null || true
  kill "$FRONTEND_PID" 2>/dev/null || true
  exit 0
}
trap cleanup INT TERM

# Load .env.local if it exists
if [ -f "$ROOT/.env.local" ]; then
  set -a
  # shellcheck source=/dev/null
  source "$ROOT/.env.local"
  set +a
  echo "[SpendOS] .env.local loaded"
fi

# Kill any existing processes on the ports (soft kill — not force)
for port in $FRONTEND_PORT $PROXY_PORT $X402_PORT; do
  pids=$(lsof -ti :"$port" 2>/dev/null || true)
  if [ -n "$pids" ]; then
    echo "[SpendOS] Clearing port $port (PID: $pids)"
    echo "$pids" | xargs kill 2>/dev/null || true
    sleep 1
  fi
done

# Start proxy backend
echo "[SpendOS] Starting proxy → http://127.0.0.1:$PROXY_PORT"
node "$ROOT/backend/spendos-proxy.mjs" &
PROXY_PID=$!

# Start x402 API server
echo "[SpendOS] Starting x402 API → http://127.0.0.1:$X402_PORT"
node "$ROOT/backend/x402-api-server.mjs" &
X402_PID=$!

# Start frontend
echo "[SpendOS] Starting frontend → http://127.0.0.1:$FRONTEND_PORT"
python3 -m http.server $FRONTEND_PORT --directory "$ROOT" --bind 127.0.0.1 &
FRONTEND_PID=$!

# Let services come up
sleep 1

# Show vault status (if vault address is set)
if [ -n "$SPENDOS_VAULT_ADDRESS" ] && [ "$SPENDOS_VAULT_ADDRESS" != "" ]; then
  echo "[SpendOS] Vault: $SPENDOS_VAULT_ADDRESS"
else
  echo "[SpendOS] Vault: not yet deployed — demo mode active"
fi

echo ""
echo "┌─────────────────────────────────────────────────────┐"
echo "│  SpendOS                                            │"
echo "│  Frontend  →  http://127.0.0.1:$FRONTEND_PORT             │"
echo "│  Proxy API →  http://127.0.0.1:$PROXY_PORT             │"
echo "│  x402 API  →  http://127.0.0.1:$X402_PORT             │"
echo "│  Press Ctrl+C to stop                               │"
echo "└─────────────────────────────────────────────────────┘"
echo ""

wait
