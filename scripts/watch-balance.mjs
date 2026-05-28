#!/usr/bin/env node
/**
 * SpendOS — Cüzdan bakiye izleyici
 * ETH ve USDC gelince bildirim verir, sonraki adımları gösterir.
 *
 * Kullanım:
 *   node scripts/watch-balance.mjs
 *   node scripts/watch-balance.mjs --once   (tek kontrol, çık)
 */

import { Contract, JsonRpcProvider, formatEther, formatUnits, getAddress } from "ethers";

const SEPOLIA_USDC  = "0x036CbD53842c5426634e7929541eC2318f3dCF7e";
const USDC_ABI      = ["function balanceOf(address) view returns (uint256)"];
const INTERVAL_MS   = 12_000;
const once          = process.argv.includes("--once");

const address  = process.env.SPENDOS_OPERATOR_ADDRESS || process.env.SPENDOS_AGENT_VAULT || "";
const rpcUrl   = process.env.BASE_SEPOLIA_RPC_URL || "https://sepolia.base.org";

if (!address) {
  console.error("SPENDOS_OPERATOR_ADDRESS veya SPENDOS_AGENT_VAULT env eksik.");
  process.exit(1);
}

const provider = new JsonRpcProvider(rpcUrl);
const usdc     = new Contract(SEPOLIA_USDC, USDC_ABI, provider);

async function check() {
  const [ethBal, usdcBal, block] = await Promise.all([
    provider.getBalance(getAddress(address)),
    usdc.balanceOf(getAddress(address)).catch(() => 0n),
    provider.getBlockNumber(),
  ]);

  const eth  = Number(formatEther(ethBal));
  const usd  = Number(formatUnits(usdcBal, 6));
  const time = new Date().toLocaleTimeString("tr-TR");

  const ethOk  = eth  >= 0.005;
  const usdcOk = usd  >= 1;

  console.log(`[${time}] block ${block} | ETH: ${eth.toFixed(4)} ${ethOk ? "✓" : "✗"} | USDC: ${usd.toFixed(2)} ${usdcOk ? "✓" : "✗"}`);

  if (ethOk && usdcOk) {
    console.log("\n  ✓ ETH ve USDC alındı — deploy'a geçebilirsin:\n");
    console.log("    USDC_ADDRESS=0x036CbD53842c5426634e7929541eC2318f3dCF7e \\");
    console.log("      node scripts/deploy-spendos-vault.mjs --network base-sepolia\n");
    console.log("    veya MockUSDC ile (Circle faucet gerekmez):\n");
    console.log("    node scripts/deploy-spendos-vault.mjs --network base-sepolia --mock-usdc\n");
    return true;
  }

  if (!ethOk) {
    console.log("    → ETH bekleniyor: https://www.coinbase.com/faucets/base-ethereum-sepolia-faucet");
  }
  if (!usdcOk) {
    console.log("    → USDC bekleniyor: https://faucet.circle.com  (Base Sepolia seç)");
    console.log("    → Ya da --mock-usdc ile deploy et, USDC gerekmez");
  }

  return false;
}

console.log(`\n  SpendOS — Bakiye İzleyici`);
console.log(`  Adres  : ${address}`);
console.log(`  RPC    : ${rpcUrl}`);
console.log(`  Basescan: https://sepolia.basescan.org/address/${address}\n`);

if (once) {
  await check();
  process.exit(0);
}

const ready = await check();
if (ready) process.exit(0);

const interval = setInterval(async () => {
  const done = await check();
  if (done) {
    clearInterval(interval);
    process.exit(0);
  }
}, INTERVAL_MS);
