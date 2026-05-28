# SpendOS Protocol MVP

## Purpose

SpendOS controls how autonomous agents spend Base USDC. The frontend creates a policy digest, the owner signs it, and the vault contract enforces the spend envelope when an approved x402/API payment settles.

## Contract

`contracts/SpendOSVault.sol`

The first contract is intentionally small and dependency-free:

- Agent owner registration
- Base USDC funding and withdrawal
- Policy authorization through owner signature
- Per-transaction limit
- Daily limit with rolling 24-hour window
- Pause/resume per agent vault
- Operator delegation for the SpendOS proxy
- Receipt event logging for approved spend

## Base USDC

Mainnet Base USDC:

`0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`

## Policy Digest Flow

1. Owner defines agent policy in the SpendOS interface.
2. Frontend produces a deterministic `policyDigest`.
3. Owner signs the policy digest from the connected wallet.
4. SpendOS proxy submits `authorizePolicy` with the signature.
5. The vault stores the active digest, daily limit, and per-transaction limit.

## Spend Flow

1. Agent requests a paid API or x402 endpoint.
2. SpendOS checks domain, contract, amount, risk, and task memo offchain.
3. The x402 proxy in `backend/spendos-proxy.mjs` creates a receipt and settlement payload.
4. If approved, the proxy calls `spendUSDC`.
5. The contract verifies operator authorization, pause state, available balance, per-transaction limit, and daily limit.
6. USDC transfers to the recipient.
7. `ReceiptRecorded` emits the service, amount, receipt hash, and active policy digest.

## x402 Proxy MVP

`backend/spendos-proxy.mjs`

Endpoints:

- `POST /v1/request_budget`
- `POST /v1/check_policy`
- `POST /v1/pay_x402`
- `POST /v1/settlement/preview`
- `POST /v1/settlement/submit`
- `GET /v1/receipts`
- `POST /v1/pause_agent`
- `POST /v1/demo/analyze_wallet`

## Agent SDK

`sdk/spendos-agent.mjs`

The SDK wraps the proxy endpoints for autonomous agents and MCP servers:

- `requestBudget`
- `checkPolicy`
- `payX402`
- `previewSettlement`
- `submitSettlement`
- `getReceipts`
- `pauseAgent`
- `resumeAgent`
- `analyzeWalletDemo`

## Next Protocol Steps

- Run the Foundry test harness in `test/SpendOSVault.t.sol`.
- Deploy `SpendOSVault` to Base Sepolia with `script/DeploySpendOSVault.s.sol`.
- Wire the proxy settlement payload to a real Base provider and signer.
- Set `SPENDOS_VAULT_ADDRESS` after Base Sepolia deploy so proxy responses include executable tx targets.
- Connect the MCP server to real agent clients and add hosted remote transport after the local stdio path is stable.
- Add domain and contract allowlist roots onchain if needed.
- Add EIP-712 typed data signing for policy authorization.
- Wire frontend `Sign Policy` to the exact contract message hash.
- Make the backend x402 proxy the authorized operator through `setOperator`.
