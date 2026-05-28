# SpendOS

Spending controls for autonomous AI agents on Base.

SpendOS gives AI agents a policy-bound USDC wallet. Owners set daily limits, per-transaction caps, domain allowlists, and risk modes. Agents spend autonomously within those rules — every payment enforced on-chain by the SpendOSVault smart contract.

---

## How it works

```
AI Agent → SpendOS SDK → Proxy (policy check) → SpendOSVault (on-chain) → USDC transfer
```

1. Owner defines a spend policy (limits, allowed domains, risk mode)
2. Policy digest is signed and stored on-chain via SpendOSVault
3. Agent calls a paid API endpoint — receives HTTP 402
4. SDK routes the payment through the proxy
5. Proxy enforces policy, builds settlement calldata
6. SpendOSVault verifies and executes the USDC transfer on Base
7. Receipt is emitted on-chain, logged off-chain

---

## Architecture

```
├── index.html              # Control room UI
├── app.js                  # Frontend logic
├── styles.css
│
├── backend/
│   ├── spendos-proxy.mjs   # Policy engine + settlement API (port 4191)
│   └── x402-api-server.mjs # Demo x402 paid endpoints (port 4192)
│
├── sdk/
│   ├── spendos-agent.mjs   # Agent SDK — fetch402, payX402, policy tools
│   └── demo-agent.mjs      # End-to-end demo: 3 real on-chain payments
│
├── mcp/
│   └── spendos-mcp-server.mjs  # MCP server — 16 tools for Claude/Codex
│
├── contracts/
│   └── SpendOSVault.sol    # On-chain policy enforcement
│
└── scripts/                # Deploy, vault admin, wallet utilities
```

---

## Quickstart

### Prerequisites

- Node.js 20+
- Python 3 (frontend server)
- A Base wallet with USDC and ETH for gas

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

Create `.env.local` in the project root:

```bash
# Network
SPENDOS_DEPLOY_NETWORK=base
CHAIN_ID=8453
BASE_RPC_URL=https://mainnet.base.org

# Wallet
PRIVATE_KEY=0x...

# Vault (after deploy)
SPENDOS_VAULT_ADDRESS=0x...
USDC_ADDRESS=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913

# Policy
SPENDOS_OPERATOR_ADDRESS=0x...
SPENDOS_AGENT_VAULT=0x...
SPENDOS_DOMAINS=api.tokensight.io,risk.baseintel.net,decode.calldata.run
SPENDOS_CONTRACTS=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913,...

# Auth
SPENDOS_REQUIRE_AUTH=true
SPENDOS_API_KEYS=spos_live_...

# CORS
SPENDOS_ALLOWED_ORIGINS=http://127.0.0.1:4180,http://localhost:4180
```

Create `config.local.js` in the project root (loaded by the frontend, never committed):

```js
window.SPENDOS_CONFIG = {
  apiKey: "spos_live_...",
  proxyUrl: "http://127.0.0.1:4191",
  x402ApiUrl: "http://127.0.0.1:4192",
  agentVault: "0x...",
  vaultContract: "0x...",
  network: "base",
  chainId: 8453,
};
```

### 3. Start all services

```bash
npm start
```

This starts:
- Frontend UI → http://127.0.0.1:4180
- Proxy API → http://127.0.0.1:4191
- x402 demo API → http://127.0.0.1:4192

### 4. Run the demo agent

```bash
npm run demo:agent
```

The demo agent calls 3 paid endpoints via the x402 protocol, paying real USDC on Base mainnet for each one.

---

## Deploy your own vault

### Base Sepolia (testnet)

```bash
# Get testnet ETH: https://www.coinbase.com/faucets/base-ethereum-sepolia-faucet
# Get testnet USDC: https://faucet.circle.com

npm run deploy:vault:mock    # deploy with MockUSDC
npm run setup:vault:mock     # registerAgent + setOperator + authorizePolicy + fundAgent
```

### Base Mainnet

```bash
npm run deploy:vault         # deploy SpendOSVault
npm run setup:vault          # full post-deploy setup
npm run vault:status         # verify on-chain state
```

Check launch readiness:

```bash
curl "http://127.0.0.1:4191/v1/launch/readiness?agentId=research-agent"
```

Expected when ready:

```json
{ "status": "ready", "score": { "passed": 7, "total": 7 } }
```

---

## SDK

```js
import { SpendOS } from "./sdk/spendos-agent.mjs";

const spendos = new SpendOS({
  baseUrl: "http://127.0.0.1:4191",
  agent: "research-agent",
  apiKey: "spos_live_...",
});

// Check policy before spending
const decision = await spendos.checkPolicy({
  domain: "api.tokensight.io",
  contract: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  amount: 0.18,
  task: "Token price lookup",
});

// Auto-pay x402 endpoints
const result = await spendos.fetch402("http://127.0.0.1:4192/v1/token-price", {
  task: "Get ETH price",
});
```

Available SDK methods: `requestBudget`, `checkPolicy`, `updatePolicy`, `payX402`, `fetch402`, `previewSettlement`, `preflightSettlement`, `submitSettlement`, `getSettlementConfig`, `getVaultStatus`, `getLaunchReadiness`, `getReceipts`, `getApprovals`, `resolveApproval`, `pauseAgent`, `resumeAgent`

---

## MCP (Claude Desktop / Codex)

Add to your MCP config:

```json
{
  "mcpServers": {
    "spendos": {
      "command": "node",
      "args": ["/path/to/spendos/mcp/spendos-mcp-server.mjs"],
      "env": {
        "SPENDOS_PROXY_URL": "http://127.0.0.1:4191",
        "SPENDOS_AGENT": "research-agent",
        "SPENDOS_API_KEYS": "spos_live_..."
      }
    }
  }
}
```

16 tools available: `get_agent_file`, `request_budget`, `check_policy`, `update_policy`, `pay_x402`, `preview_settlement`, `preflight_settlement`, `get_settlement_config`, `get_vault_status`, `get_launch_readiness`, `submit_settlement`, `get_receipts`, `get_approvals`, `resolve_approval`, `pause_agent`, `resume_agent`

---

## x402 Protocol

SpendOS implements the x402 payment protocol for HTTP APIs.

1. Agent calls a paid endpoint
2. API returns `HTTP 402 Payment Required` with payment requirements
3. Agent calls `fetch402()` — proxy checks policy, executes on-chain settlement
4. Agent retries the request with `X-Payment: spendos:{receiptId}` header
5. API verifies receipt and returns the response

---

## Proxy API

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check |
| GET | `/v1/agents/:id` | Agent policy + vault metadata |
| POST | `/v1/request_budget` | Reserve bounded USDC budget |
| POST | `/v1/check_policy` | Evaluate payment before authorizing |
| POST | `/v1/pay_x402` | Authorize and record payment |
| POST | `/v1/settlement/preview` | Build settlement calldata (read-only) |
| POST | `/v1/settlement/preflight` | On-chain preflight check |
| POST | `/v1/settlement/submit` | Submit on-chain settlement transaction |
| GET | `/v1/settlement/config` | Vault readiness and operator status |
| GET | `/v1/vault/status` | On-chain vault state |
| GET | `/v1/launch/readiness` | Aggregated 7-point launch check |
| GET | `/v1/receipts` | Spend history for audit |
| GET | `/v1/approvals` | Pending or resolved approval requests |
| POST | `/v1/approvals/:id/resolve` | Approve or deny a payment request |
| POST | `/v1/pause_agent` | Suspend agent spend authority |
| POST | `/v1/resume_agent` | Restore agent spend authority |
| POST | `/v1/update_policy` | Update limits, allowlists, risk mode |

Auth: `X-SpendOS-Key: spos_live_...`

---

## SpendOSVault Contract

The vault enforces all spend rules on-chain:

- Per-transaction USDC limit
- Rolling 24-hour daily limit
- Owner-signed policy digest (tamper-proof)
- Operator delegation (proxy executes, owner controls)
- Pause/resume per agent
- `ReceiptRecorded` event for every approved payment

**Base Mainnet:** `0xC3C474a7917eCFDE5A25B64A58a190f901F9241A`  
**USDC:** `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`

---

## Scripts

```bash
npm run wallet:new          # Generate a new testnet wallet
npm run wallet:check        # Check wallet balance
npm run compile:contracts   # Compile Solidity contracts
npm run deploy:vault        # Deploy SpendOSVault to Base
npm run setup:vault         # Post-deploy: register, fund, authorize
npm run vault:status        # Check on-chain vault state
npm run vault:fund          # Fund agent vault with USDC
npm run vault:authorize     # Authorize a new policy on-chain
npm run export:env          # Export runtime env from deployment file
```

---

## Tests

```bash
npm test                    # Run all tests
npm run test:proxy          # Proxy unit tests (30)
npm run test:sdk            # SDK unit tests (8)
npm run test:mcp            # MCP server tests (10)
npm run test:scripts        # Script tests
```

---

## Stack

- **Chain:** Base (EVM, chainId 8453)
- **Token:** USDC
- **Contract:** Solidity 0.8.x, no external dependencies
- **Backend:** Node.js ESM, Ethers.js v6
- **Frontend:** Vanilla HTML/JS
- **Protocol:** x402 (HTTP 402 Payment Required)
- **Agent interface:** MCP (Model Context Protocol)
