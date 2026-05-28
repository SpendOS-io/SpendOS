# SpendOS Launch Checklist

## Current State

- UI control room runs locally on `http://127.0.0.1:4180`.
- SpendOS proxy runs locally on `http://127.0.0.1:4191`.
- Proxy supports policies, receipts, idempotency, approval queue, settlement preview, onchain preflight, and settlement submit.
- SDK and MCP server expose the agent tool layer.
- Contract artifacts can be generated with `npm run compile:contracts`.

## Contract Launch Path

1. Compile contracts.

```txt
npm run compile:contracts
```

2. Dry-run deploy configuration.

```txt
npm run deploy:vault:dry
```

3. Deploy vault on Base Sepolia.

```txt
BASE_SEPOLIA_RPC_URL=https://sepolia.base.org
PRIVATE_KEY=0x...
USDC_ADDRESS=0x...
npm run deploy:vault -- --network base-sepolia
```

For a closed demo network, deploy with mock USDC:

```txt
BASE_SEPOLIA_RPC_URL=https://sepolia.base.org
PRIVATE_KEY=0x...
npm run deploy:vault -- --network base-sepolia --mock-usdc
```

4. Configure proxy settlement.

```txt
SPENDOS_DEPLOYMENT_FILE=deployments/base-sepolia-84532.json
BASE_SEPOLIA_RPC_URL=https://sepolia.base.org
SPENDOS_OPERATOR_PRIVATE_KEY=0x...
npm run proxy
```

Optional: generate a runtime env file from deployment output.

```txt
npm run export:env -- --deployment deployments/base-sepolia-84532.json
```

5. Authorize agent policy.

```txt
SPENDOS_VAULT_ADDRESS=0x...
USDC_ADDRESS=0x...
SPENDOS_AGENT_VAULT=0x...
SPENDOS_OWNER_PRIVATE_KEY=0x...
npm run vault:authorize -- --network base-sepolia --daily-limit 10 --per-transaction-limit 0.25
```

6. Set the proxy signer as operator.

```txt
SPENDOS_VAULT_ADDRESS=0x...
PRIVATE_KEY=0xOwner...
SPENDOS_OPERATOR_ADDRESS=0xOperator...
npm run vault:set-operator -- --network base-sepolia
```

7. Fund the agent vault.

```txt
SPENDOS_VAULT_ADDRESS=0x...
USDC_ADDRESS=0x...
PRIVATE_KEY=0xOwner...
SPENDOS_AGENT_VAULT=0x...
npm run vault:fund -- --network base-sepolia --amount 10
```

8. Check onchain vault status.

```txt
SPENDOS_VAULT_ADDRESS=0x...
USDC_ADDRESS=0x...
SPENDOS_AGENT_VAULT=0x...
npm run vault:status -- --network base-sepolia
```

Or through the running proxy/UI:

```txt
curl "http://127.0.0.1:4191/v1/vault/status?agentId=research-agent"
```

9. Verify proxy readiness.

```txt
curl http://127.0.0.1:4191/v1/settlement/config
```

Expected:

```json
{
  "status": "ready",
  "functionSelector": "0xe79d5d2a"
}
```

10. Run aggregated launch readiness.

```txt
curl "http://127.0.0.1:4191/v1/launch/readiness?agentId=research-agent"
```

Expected when launch-critical paths are ready:

```json
{
  "status": "ready",
  "score": {
    "passed": 7,
    "total": 7
  }
}
```

11. Run onchain settlement preflight before live submit.

```txt
curl -X POST http://127.0.0.1:4191/v1/settlement/preflight \
  -H "content-type: application/json" \
  -d '{"agentId":"research-agent","domain":"api.tokensight.io","contract":"0x8335...2913","amount":0.04,"task":"launch preflight"}'
```

Expected when vault/operator policy is ready:

```json
{
  "status": "ready",
  "reason": "preflight_passed"
}
```

## Remaining Before Public Launch

- Deploy and verify `SpendOSVault` on Base Sepolia.
- Register/fund a real agent vault with USDC or mock USDC.
- Set owner operator permission for the proxy signer.
- Wire production auth and hosted RPC to the proxy runtime.
- Move JSON state to SQLite/Postgres before multi-user launch.
- Add API auth, rate limits, structured logs, and deployment monitoring.
