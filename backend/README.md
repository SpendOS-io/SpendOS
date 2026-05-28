# SpendOS x402 Proxy MVP

This backend is the first policy enforcement service for SpendOS.

It accepts autonomous agent payment attempts, checks active policy, creates receipts, and returns a settlement payload that maps to `SpendOSVault.spendUSDC`.

## Run

```txt
npm run proxy
```

Default local URL:

```txt
http://127.0.0.1:4191
```

The static SpendOS app expects this URL by default. To point the UI at another proxy, set `window.SPENDOS_PROXY_URL` before `app.js` loads.

## Deployment Config

After `npm run deploy:vault`, point the proxy at the deployment record:

```txt
SPENDOS_DEPLOYMENT_FILE=deployments/base-sepolia-84532.json npm run proxy
```

The proxy will load `vaultAddress`, `usdcAddress`, `network`, and `chainId` from that file unless explicit env vars override them.

Generate a runtime env file:

```txt
npm run export:env -- --deployment deployments/base-sepolia-84532.json
```

## State Storage

The proxy persists agent balances, paused state, receipts, budget reservations, and idempotency replay records to:

```txt
data/spendos-state.json
```

Override the path:

```txt
SPENDOS_STATE_FILE=/absolute/path/spendos-state.json npm run proxy
```

Disable disk persistence for isolated tests or throwaway sessions:

```txt
SPENDOS_STATE_FILE=memory npm run proxy
```

## Endpoints

All mutating endpoints accept an `idempotencyKey` JSON field or `Idempotency-Key` header.

Retrying the same key with the same payload returns the original result with `replayed: true` and does not charge twice. Reusing the same key with a different payload is blocked with `idempotency_key_conflict`.

### `GET /health`

Health check.

### `GET /v1/agents/:agentId`

Returns agent policy, vault metadata, limits, and current policy digest.

### `POST /v1/request_budget`

Reserve bounded budget before an agent starts a paid task.

```json
{
  "agentId": "research-agent",
  "task": "Analyze this wallet",
  "maxSpend": 0.42
}
```

### `POST /v1/check_policy`

Evaluate a payment without authorizing it.

```json
{
  "agentId": "research-agent",
  "domain": "api.tokensight.io",
  "contract": "0x8335...2913",
  "amount": 0.18,
  "task": "Token price API for wallet analysis"
}
```

### `POST /v1/policies/update`

Update live policy for an agent and persist it to disk.

```json
{
  "agentId": "research-agent",
  "dailyLimit": 10,
  "perTransactionLimit": 0.25,
  "domains": ["api.tokensight.io", "risk.baseintel.net"],
  "contracts": ["0x8335...2913", "0x4200...0006"],
  "riskMode": "adaptive",
  "paused": false
}
```

Returns the new `policyDigest` and full agent policy snapshot.

### `POST /v1/pay_x402`

Evaluate and authorize an x402 payment when approved.

Returns:

- x402 payment header
- receipt
- settlement payload for `SpendOSVault.spendUSDC`
- ABI-encoded transaction calldata

### `POST /v1/settlement/preview`

Evaluate policy and generate ABI-encoded settlement calldata without mutating agent balance or creating an x402 authorization.

Set this env var to make returned transactions directly target a deployed vault:

```txt
SPENDOS_VAULT_ADDRESS=0x...
```

### `POST /v1/settlement/preflight`

Evaluate policy, build the same `SpendOSVault.spendUSDC` calldata, and run a read-only onchain `eth_call` before submitting a transaction.

Returns:

- `status: "ready"` when the calldata can execute
- `status: "would_revert"` with the revert reason when the vault would reject it
- `status: "not_configured"` when vault address, RPC, or operator address is missing
- gas estimate when the RPC can estimate it

This endpoint does not create receipts or mutate agent spend state.

### `GET /v1/settlement/config`

Returns settlement readiness for launch and UI diagnostics:

- configured vault address
- RPC readiness
- operator signer readiness
- operator address when available
- `spendUSDC` function selector

### `GET /v1/vault/status?agentId=research-agent`

Reads configured `SpendOSVault` onchain state for an agent:

- registered owner
- vault balance
- daily and per-transaction limits
- spent window
- paused state
- policy digest
- operator authorization

Returns `status: "not_configured"` until `SPENDOS_VAULT_ADDRESS` and RPC are configured.

### `GET /v1/launch/readiness?agentId=research-agent`

Aggregates launch-critical checks into one operational report:

- deployment/vault address readiness
- RPC readiness
- operator signer readiness
- onchain vault policy
- operator permission
- USDC funding
- read-only settlement preflight

Returns `status: "ready"` only when every critical check passes, otherwise returns `status: "not_ready"` with ordered `nextActions`.

### `POST /v1/settlement/submit`

Evaluate policy, build calldata, and submit `spendUSDC` using the configured operator signer.

Required env:

```txt
SPENDOS_VAULT_ADDRESS=0x...
BASE_RPC_URL=https://mainnet.base.org
SPENDOS_OPERATOR_PRIVATE_KEY=0x...
```

For Base Sepolia, use:

```txt
BASE_SEPOLIA_RPC_URL=https://sepolia.base.org
```

If these are missing, the endpoint returns `503` with `status: "not_configured"` and the settlement preview attached.

### `GET /v1/receipts?agentId=research-agent`

Returns recorded proxy receipts.

### `GET /v1/approvals?agentId=research-agent&status=pending`

Returns owner approval requests created when an otherwise allowlisted payment exceeds policy authority.

### `POST /v1/approvals/resolve`

Approve or deny a pending payment approval.

```json
{
  "approvalId": "approval_...",
  "decision": "approved",
  "resolver": "0xOwner...",
  "signature": "0x..."
}
```

Approving authorizes the original x402 receipt and mutates agent spend once. Repeating the same approval resolution returns the already-resolved result without charging twice.

### `POST /v1/pause_agent`

Pause or resume an agent.

```json
{
  "agentId": "research-agent",
  "paused": true
}
```

### `POST /v1/demo/analyze_wallet`

Runs the flagship demo:

- 2 approved paid tools
- 1 blocked risky endpoint
- receipts attached

The frontend x402 page calls this endpoint from **Analyze Wallet Demo** and renders the response in the live proxy panel.

## Test

```txt
npm run test:proxy
```

## SDK

The agent SDK lives in `sdk/spendos-agent.mjs`.

```js
import { SpendOS } from "./sdk/spendos-agent.mjs";

const spendos = new SpendOS({ agent: "research-agent" });
const payment = await spendos.payX402({
  domain: "api.tokensight.io",
  contract: "0x8335...2913",
  amount: 0.18,
  task: "Token price API for wallet analysis"
});
```
