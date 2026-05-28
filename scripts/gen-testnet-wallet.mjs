#!/usr/bin/env node
/**
 * SpendOS — Testnet wallet üretici
 * Sadece testnet için kullan. Private key'i kimseyle paylaşma.
 *
 * Kullanım:
 *   node scripts/gen-testnet-wallet.mjs
 *   node scripts/gen-testnet-wallet.mjs --write-env   (.env.local'ı günceller)
 */

import { readFileSync, writeFileSync } from "node:fs";
import { Wallet } from "ethers";

const writeEnv = process.argv.includes("--write-env");

const wallet = Wallet.createRandom();
const privateKey = wallet.privateKey;
const address   = wallet.address;

// Terminale sadece PUBLIC adres + talimatlar bas — key asla stdout'a yazılmaz
console.log("\n╔══════════════════════════════════════════════════════════════╗");
console.log("║           SpendOS Testnet Wallet — YENİ OLUŞTURULDU         ║");
console.log("╚══════════════════════════════════════════════════════════════╝");
console.log(`\n  Cüzdan Adresi: ${address}`);
console.log(`\n  Private key   → ${writeEnv ? ".env.local dosyasına yazıldı" : "sadece bellekte (--write-env ile kaydet)"}`);
console.log("\n  ── Sonraki Adımlar ───────────────────────────────────────────");
console.log("  1. Bu adrese Base Sepolia ETH gönder (gas için ~0.01 ETH yeterli)");
console.log("     Faucet: https://www.coinbase.com/faucets/base-ethereum-sepolia-faucet");
console.log("  2. Bu adrese Base Sepolia USDC gönder (test için ~10 USDC)");
console.log("     Faucet: https://faucet.circle.com  (Base Sepolia seç)");
console.log("  3. Fonlama tamamlanınca deploy çalıştır:");
console.log("     node scripts/deploy-spendos-vault.mjs --network base-sepolia --mock-usdc");
console.log("\n  ── Fon Durumu Takip ─────────────────────────────────────────");
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
  console.log("  ✓ .env.local güncellendi (PRIVATE_KEY, OPERATOR, AGENT_VAULT)\n");
} else {
  console.log("  ℹ  .env.local'ı güncellemek için: node scripts/gen-testnet-wallet.mjs --write-env\n");
}
