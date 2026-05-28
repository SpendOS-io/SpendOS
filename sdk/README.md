# SpendOS Agent SDK

The SDK is a lightweight ESM client for the SpendOS x402 proxy.

It is designed for custom agents, MCP servers, Codex/Claude bridges, and backend workers that need controlled Base USDC spend.

## Usage

```js
import { SpendOS } from "./sdk/spendos-agent.mjs";

const spendos = new SpendOS({
  baseUrl: "http://127.0.0.1:4191",
  agent: "research-agent",
});

await spendos.requestBudget({
  task: "Analyze this wallet",
  maxSpend: 0.42,
  idempotencyKey: "wallet-analysis-001"
});

const decision = await spendos.checkPolicy({
  domain: "api.tokensight.io",
  contract: "0x8335...2913",
  amount: 0.18,
  task: "Token price API for wallet analysis",
});

await spendos.updatePolicy({
  dailyLimit: 10,
  perTransactionLimit: 0.25,
  domains: ["api.tokensight.io", "risk.baseintel.net"],
  contracts: ["0x8335...2913", "0x4200...0006"],
  riskMode: "adaptive"
});

if (decision.status === "approved") {
  const preview = await spendos.previewSettlement({
    domain: "api.tokensight.io",
    contract: "0x8335...2913",
    amount: 0.18,
    task: "Token price API for wallet analysis",
    idempotencyKey: "wallet-analysis-price-001"
  });

  const preflight = await spendos.preflightSettlement({
    domain: "api.tokensight.io",
    contract: "0x8335...2913",
    amount: 0.18,
    task: "Token price API for wallet analysis"
  });

  const payment = await spendos.payX402({
    domain: "api.tokensight.io",
    contract: "0x8335...2913",
    amount: 0.18,
    task: "Token price API for wallet analysis",
  });

  console.log(payment.x402.header);
  console.log(preflight.status);
  console.log(preview.settlement.transaction.data);
  console.log(payment.settlement);
}

const pendingApprovals = await spendos.getApprovals({ status: "pending" });
await spendos.resolveApproval({
  approvalId: pendingApprovals.approvals[0].id,
  decision: "approved",
  resolver: "owner"
});
```

## Methods

- `health()`
- `getAgent(agent?)`
- `requestBudget(payload)`
- `checkPolicy(payload)`
- `updatePolicy(payload)`
- `payX402(payload)`
- `previewSettlement(payload)`
- `preflightSettlement(payload)`
- `getSettlementConfig()`
- `getVaultStatus({ agent }?)`
- `getLaunchReadiness({ agent }?)`
- `submitSettlement(payload)`
- `getReceipts({ agent }?)`
- `getApprovals({ agent, status }?)`
- `resolveApproval(payload)`
- `pauseAgent({ agent, paused }?)`
- `resumeAgent({ agent }?)`
- `analyzeWalletDemo({ agent }?)`

## Idempotency

Pass `idempotencyKey` on payment and budget calls when retrying agent work. SpendOS will replay the original response instead of spending twice.

## Demo

Start the proxy:

```txt
npm run proxy
```

Run the demo agent:

```txt
npm run demo:agent
```

Run the MCP server for Claude/Codex/custom agents:

```txt
npm run mcp
```

## Test

```txt
npm run test:sdk
```
