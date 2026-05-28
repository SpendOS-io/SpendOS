# SpendOS Contracts

## SpendOSVault

`SpendOSVault.sol` is the first protocol contract for SpendOS.

Deploy constructor parameter on Base:

```txt
usdcAddress = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
```

## MVP Responsibilities

- Hold agent-specific USDC balances.
- Store owner-approved policy digests.
- Enforce daily and per-transaction spend limits.
- Let owners pause agents.
- Let owners delegate a SpendOS proxy/operator.
- Transfer USDC only after policy checks pass.
- Emit receipt events for audit trails.

## Intended Operator Model

The SpendOS backend/x402 proxy should be added with `setOperator`.

The agent never calls the contract directly. The proxy checks endpoint/domain/risk policy offchain, then calls `spendUSDC` only for approved payment attempts.

## Compile

This repo includes a `solc-js` compile path so artifacts can be generated even when Foundry is not installed:

```txt
npm run compile:contracts
```

Artifacts are written to:

```txt
artifacts/SpendOSVault.json
artifacts/MockUSDC.json
```

## JS Deploy Runner

Dry-run deploy config:

```txt
npm run deploy:vault:dry
```

Deploy with an existing USDC address:

```txt
BASE_SEPOLIA_RPC_URL=https://sepolia.base.org
PRIVATE_KEY=0x...
USDC_ADDRESS=0x...
npm run deploy:vault -- --network base-sepolia
```

Deploy a mock USDC plus vault for a test network:

```txt
BASE_SEPOLIA_RPC_URL=https://sepolia.base.org
PRIVATE_KEY=0x...
npm run deploy:vault -- --network base-sepolia --mock-usdc
```

Deployment records are written under `deployments/`.

## Vault Bootstrap

After deployment, use the vault admin CLI to prepare an agent for real settlement:

```txt
SPENDOS_VAULT_ADDRESS=0x...
USDC_ADDRESS=0x...
SPENDOS_AGENT_VAULT=0x...
SPENDOS_OWNER_PRIVATE_KEY=0x...
npm run vault:authorize -- --network base-sepolia --daily-limit 10 --per-transaction-limit 0.25
```

```txt
SPENDOS_VAULT_ADDRESS=0x...
PRIVATE_KEY=0xOwner...
SPENDOS_OPERATOR_ADDRESS=0xOperator...
npm run vault:set-operator -- --network base-sepolia
```

```txt
SPENDOS_VAULT_ADDRESS=0x...
USDC_ADDRESS=0x...
PRIVATE_KEY=0xOwner...
SPENDOS_AGENT_VAULT=0x...
npm run vault:fund -- --network base-sepolia --amount 10
```

Check state:

```txt
SPENDOS_VAULT_ADDRESS=0x...
USDC_ADDRESS=0x...
SPENDOS_AGENT_VAULT=0x...
npm run vault:status -- --network base-sepolia
```

## Verification Status

`solc-js` compilation is available in this workspace. Foundry is still optional and not installed locally, so Foundry tests require installing Foundry first.

## Foundry Commands

After Foundry is installed:

```txt
forge test
```

Deploy to Base Sepolia:

```txt
BASE_SEPOLIA_RPC_URL=https://sepolia.base.org
USDC_ADDRESS=<base-sepolia-usdc-or-mock-usdc>
PRIVATE_KEY=<deployer-private-key>
forge script script/DeploySpendOSVault.s.sol:DeploySpendOSVault --rpc-url base_sepolia --broadcast --verify
```

Deploy to Base mainnet:

```txt
BASE_RPC_URL=https://mainnet.base.org
USDC_ADDRESS=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
PRIVATE_KEY=<deployer-private-key>
forge script script/DeploySpendOSVault.s.sol:DeploySpendOSVault --rpc-url base --broadcast --verify
```
