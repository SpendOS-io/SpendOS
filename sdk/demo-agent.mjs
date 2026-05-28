#!/usr/bin/env node
/**
 * SpendOS Demo Agent
 * Gerçek x402 ödeme döngüsünü uçtan uca test eder:
 *   1. x402 API'ye istek at → 402 al
 *   2. SpendOS proxy'den ödeme al
 *   3. On-chain settle et
 *   4. X-Payment header ile tekrar dene → veri al
 */

import { SpendOS } from "./spendos-agent.mjs";

const PROXY  = process.env.SPENDOS_PROXY_URL  || "http://127.0.0.1:4191";
const API    = process.env.X402_API_URL        || "http://127.0.0.1:4192";
const AGENT  = process.env.SPENDOS_AGENT       || "research-agent";
const WALLET = process.env.SPENDOS_AGENT_VAULT || "";

const spendos = new SpendOS({ baseUrl: PROXY, agent: AGENT });

function log(label, data) {
  console.log(`\n── ${label} ${"─".repeat(Math.max(0, 50 - label.length))}`);
  console.log(JSON.stringify(data, null, 2));
}

async function run() {
  console.log("\n╔══════════════════════════════════════════════╗");
  console.log("║       SpendOS Demo Agent — x402 Flow        ║");
  console.log("╚══════════════════════════════════════════════╝");
  console.log(`  Proxy : ${PROXY}`);
  console.log(`  API   : ${API}`);
  console.log(`  Agent : ${AGENT}\n`);

  // 1. Proxy sağlık kontrolü
  const health = await spendos.health();
  log("1. Proxy Health", { status: health.status, time: health.time });

  // 2. Agent durumu
  const agent = await spendos.getAgent();
  log("2. Agent Status", {
    agentId: agent.agentId,
    balance: `${agent.balance} USDC`,
    dailyLimit: `${agent.dailyLimit} USDC`,
    spentToday: `${agent.spentToday} USDC`,
    paused: agent.paused,
  });

  if (agent.balance < 0.25) {
    console.log("\n  ✗ Yetersiz bakiye — vault'u fonla: npm run vault:fund");
    process.exit(1);
  }

  // 3. Token fiyatları — x402 ödeme döngüsü
  console.log("\n── 3. Token Price API (0.05 USDC) ──────────────────");
  console.log("  → x402 API'ye istek atılıyor...");
  const priceResult = await spendos.fetch402(`${API}/v1/token-price`, {
    task: "Token price lookup for portfolio analysis",
    recipient: WALLET,
  });
  console.log(`  ✓ Ödendi: ${priceResult._payment?.amount} USDC | tx: ${priceResult._payment?.txHash}`);
  console.log("  Veri:", JSON.stringify(priceResult.data?.prices, null, 4));

  // 4. Wallet risk analizi — x402 ödeme döngüsü
  console.log("\n── 4. Wallet Risk Analysis (0.10 USDC) ─────────────");
  console.log("  → x402 API'ye istek atılıyor...");
  const riskResult = await spendos.fetch402(
    `${API}/v1/wallet-risk?address=${WALLET || "0x1A01621eB367e25B3584dD1e2dd0b5b7A2497b47"}`,
    { task: "Wallet risk scan before transaction", recipient: WALLET },
  );
  console.log(`  ✓ Ödendi: ${riskResult._payment?.amount} USDC | tx: ${riskResult._payment?.txHash}`);
  console.log("  Risk skoru:", riskResult.data?.riskScore, `(${riskResult.data?.riskLabel})`);
  console.log("  Sinyaller:", JSON.stringify(riskResult.data?.signals, null, 4));

  // 5. Calldata decode — x402 ödeme döngüsü
  console.log("\n── 5. Calldata Decode (0.08 USDC) ──────────────────");
  console.log("  → x402 API'ye istek atılıyor...");
  const decodeResult = await spendos.fetch402(
    `${API}/v1/calldata-decode?calldata=0xe79d5d2a`,
    { task: "Decode spendUSDC calldata", recipient: WALLET },
  );
  console.log(`  ✓ Ödendi: ${decodeResult._payment?.amount} USDC | tx: ${decodeResult._payment?.txHash}`);
  console.log("  Decode:", JSON.stringify(decodeResult.data?.decoded, null, 4));

  // 6. Receipt özeti
  const receipts = await spendos.getReceipts();
  const session = receipts.receipts.filter((r) => r.status === "submitted").slice(0, 5);
  const total = session.reduce((s, r) => s + (r.amount || 0), 0);

  console.log("\n── 6. Oturum Özeti ──────────────────────────────────");
  console.log(`  Toplam harcanan : ${total.toFixed(2)} USDC`);
  console.log(`  İşlem sayısı    : ${session.length}`);
  session.forEach((r) => {
    console.log(`  • ${r.domain} — ${r.amount} USDC — tx: ${r.txHash?.slice(0, 18)}...`);
  });

  console.log("\n  ✓ Demo tamamlandı. Vault bakiyesi güncellendi.\n");
}

run().catch((err) => {
  console.error("\n  ✗ HATA:", err.message);
  if (err.payload) console.error("  Detay:", JSON.stringify(err.payload, null, 2));
  process.exitCode = 1;
});
