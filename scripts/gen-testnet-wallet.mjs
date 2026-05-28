#!/usr/bin/env node
/**
 * SpendOS — Testnet wallet generator
 * For testnet use only. Never share your private key.
 *
 * Usage:
 *   node scripts/gen-testnet-wallet.mjs
 *   node scripts/gen-testnet-wallet.mjs --write-env   (writes to .env.local)
 */

import { readFileSync, writeFileSync } from "node:fs";
import { Wallet } from "ethers";

const writeEnv = process.argv.includes("--write-env");

const wallet = Wallet.createRandom();
const privateKey = wallet.privateKey;
const address   = wallet.address;

// Only print PUBLIC address + instructions to terminal — key is never written to stdout
console.log("\n╔══════════════════════════════════════════════════════════════╗");
console.log("║              SpendOS Testnet Wallet — GENERATED              ║");
console.log("╚══════════════════════════════════════════════════════════════╝");
console.log(`\n  Wallet Address: ${address}`);
console.log(`\n  Private key   → ${writeEnv ? "written to .env.local" : "in memory only (use --write-env to save)"}`);
console.log("\n  ── Next Steps ────────────────────────────────────────────────");
console.log("  1. Send Base Sepolia ETH to this address (~0.01 ETH for gas)");
console.log("     Faucet: https://www.coinbase.com/faucets/base-ethereum-sepolia-faucet");
console.log("  2. Send Base Sepolia USDC to this address (~10 USDC for testing)");
console.log("     Faucet: https://faucet.circle.com  (select Base Sepolia)");
console.log("  3. Once funded, run deploy:");
console.log("     node scripts/deploy-spendos-vault.mjs --network base-sepolia --mock-usdc");
console.log("\n  ── Track Funding ────────────────────────────────────────────");
console.log(`  https://sepolia.basescan.org/address/${address}`);
console.log("─────────────────────────────────────────────────────────────────\n");

if (writeEnv) {
  const envPath = new URL("../.env.local", import.meta.url).pathname;
  let content = readFileSync(envPath, "utf8");

  content = content
    .replace(/^PRIVATE_KEY=.*$/m,                      `PRIVATE_KEY=${privateKey}`)
    .replace(/^SPENDOS_DEPLOYER_PRIVATE_KEY=.*$/m,     `SPENDOS_DEPLOYER_PRIVATE_KEY=${privateKey}`)
    .replace(/^SPENDOS_OPERATOR_PRIVATE_KEY=.*$/m,     `SPENDOS_OPERATOR_PRIVATE_KEY=${privateKey}`)
    .replace(/^SPENDOS_OPERATOR_ADDRESS=.*$/m,         `SPENDOS_OPERATOR_ADDRESS=${address}`)
    .replace(/^SPENDOS_AGENT_VAULT=.*$/m,              `SPENDOS_AGENT_VAULT=${address}`);

  writeFileSync(envPath, content, "utf8");
  console.log("  ✓ .env.local updated (PRIVATE_KEY, OPERATOR, AGENT_VAULT)\n");
} else {
  console.log("  ℹ  To update .env.local run: node scripts/gen-testnet-wallet.mjs --write-env\n");
}
