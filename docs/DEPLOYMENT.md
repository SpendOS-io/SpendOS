# SpendOS — Base Sepolia Deployment Guide

## 1. Prerequisites

### Set up a testnet wallet
- Create a new wallet in MetaMask (for TESTNET use only)
- Copy the private key
- Get Base Sepolia ETH: https://www.coinbase.com/faucets/base-ethereum-sepolia-faucet

### Get Base Sepolia USDC
- https://faucet.circle.com → select "Base Sepolia" → send USDC to your wallet address
- 10 USDC is sufficient

---

## 2. Fill in .env.local

```
cd ~/Documents/Codex/2026-05-25/base-a-nda-ai-agent-trendi
```

Fill in the following fields in `.env.local`:

```bash
PRIVATE_KEY=0x<testnet-private-key>
SPENDOS_DEPLOYER_PRIVATE_KEY=0x<testnet-private-key>
SPENDOS_OPERATOR_PRIVATE_KEY=0x<operator-private-key>   # can be the same wallet or a different one
BASE_SEPOLIA_RPC_URL=https://sepolia.base.org
```

---

## 3. Dry-run (no risk, validation only)

```bash
node scripts/deploy-spendos-vault.mjs --dry-run
```

Expected output:
```json
{
  "status": "dry_run",
  "network": "base-sepolia",
  "rpcConfigured": true,
  "deployerConfigured": true,
  ...
}
```

---

## 4. Deploy

```bash
# Deploy to Base Sepolia with MockUSDC (if you don't have Circle faucet USDC)
node scripts/deploy-spendos-vault.mjs --network base-sepolia --mock-usdc

# OR use Circle faucet USDC (USDC_ADDRESS must be set in env)
USDC_ADDRESS=0x036CbD53842c5426634e7929541eC2318f3dCF7e \
  node scripts/deploy-spendos-vault.mjs --network base-sepolia
```

> Circle's Base Sepolia USDC address: `0x036CbD53842c5426634e7929541eC2318f3dCF7e`

---

## 5. Update .env.local with Deploy Output

When the deploy completes, the terminal will print something like:

```json
{
  "status": "deployed",
  "network": "base-sepolia",
  "vaultAddress": "0x...",
  "txHash": "0x..."
}
```

Add these values to `.env.local`:

```bash
SPENDOS_VAULT_ADDRESS=0x<vaultAddress>
USDC_ADDRESS=0x036CbD53842c5426634e7929541eC2318f3dCF7e
```

---

## 6. Register and Fund the Agent Vault

```bash
# Set the agent vault address in .env.local
SPENDOS_AGENT_VAULT=0x<agent-wallet-address>

# Check vault status
node scripts/vault-admin.mjs status

# Authorize policy
node scripts/vault-admin.mjs authorize-policy

# Send USDC (10 USDC)
node scripts/vault-admin.mjs fund --amount 10
```

---

## 7. Start Proxy in Live Mode

```bash
./start.sh
```

The proxy can now perform real on-chain transactions against the vault address in `.env.local`.

---

## 8. Live Vault Check from Frontend

1. Open `http://127.0.0.1:4180` in your browser
2. Click **Launch App** → go to the **Vault** tab
3. Click **Run Launch Check**
4. If all 7/7 checks pass, the system is live

---

## Basescan

- https://sepolia.basescan.org/address/<SPENDOS_VAULT_ADDRESS>

---

## Mainnet Migration (Future)

For mainnet deploy:
```bash
PRIVATE_KEY=0x<mainnet-key> \
USDC_ADDRESS=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 \
  node scripts/deploy-spendos-vault.mjs --network base
```

> Real funds will be spent on mainnet. Run a full test on Sepolia first.
