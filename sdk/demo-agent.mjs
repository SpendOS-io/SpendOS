#!/usr/bin/env node
/**
 * SpendOS Demo Agent
 * Tests the real x402 payment cycle end-to-end:
 *   1. Request x402 API → receive 402
 *   2. Get payment from SpendOS proxy
 *   3. Settle on-chain
 *   4. Retry with X-Payment header → receive data
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

  // 1. Proxy health check
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
    console.log("\n  ✗ Insufficient balance — fund the vault: npm run vault:fund");
    process.exit(1);
  }

  // 3. Token prices — x402 payment cycle
  console.log("\n── 3. Token Price API (0.05 USDC) ──────────────────");
  console.log("  → Calling x402 API...");
  const priceResult = await spendos.fetch402(`${API}/v1/token-price`, {
    task: "Token price lookup for portfolio analysis",
    recipient: WALLET,
  });
  console.log(`  ✓ Paid: ${priceResult._payment?.amount} USDC | tx: ${priceResult._payment?.txHash}`);
  console.log("  Data:", JSON.stringify(priceResult.data?.prices, null, 4));

  // 4. Wallet risk analysis — x402 payment cycle
  console.log("\n── 4. Wallet Risk Analysis (0.10 USDC) ─────────────");
  console.log("  → Calling x402 API...");
  const riskResult = await spendos.fetch402(
    `${API}/v1/wallet-risk?address=${WALLET || "0x1A01621eB367e25B3584dD1e2dd0b5b7A2497b47"}`,
    { task: "Wallet risk scan before transaction", recipient: WALLET },
  );
  console.log(`  ✓ Paid: ${riskResult._payment?.amount} USDC | tx: ${riskResult._payment?.txHash}`);
  console.log("  Risk score:", riskResult.data?.riskScore, `(${riskResult.data?.riskLabel})`);
  console.log("  Signals:", JSON.stringify(riskResult.data?.signals, null, 4));

  // 5. Calldata decode — x402 payment cycle
  console.log("\n── 5. Calldata Decode (0.08 USDC) ──────────────────");
  console.log("  → Calling x402 API...");
  const decodeResult = await spendos.fetch402(
    `${API}/v1/calldata-decode?calldata=0xe79d5d2a`,
    { task: "Decode spendUSDC calldata", recipient: WALLET },
  );
  console.log(`  ✓ Paid: ${decodeResult._payment?.amount} USDC | tx: ${decodeResult._payment?.txHash}`);
  console.log("  Decode:", JSON.stringify(decodeResult.data?.decoded, null, 4));

  // 6. Receipt summary
  const receipts = await spendos.getReceipts();
  const session = receipts.receipts.filter((r) => r.status === "submitted").slice(0, 5);
  const total = session.reduce((s, r) => s + (r.amount || 0), 0);

  console.log("\n── Session Summary ───────────────────────────────────");
  console.log(`  Total spent      : ${total.toFixed(2)} USDC`);
  console.log(`  Transactions     : ${session.length}`);
  session.forEach((r) => {
    console.log(`  • ${r.domain} — ${r.amount} USDC — tx: ${r.txHash?.slice(0, 18)}...`);
  });

  console.log("\n  ✓ Demo complete. Vault balance updated.\n");
}

run().catch((err) => {
  console.error("\n  ✗ ERROR:", err.message);
  if (err.payload) console.error("  Detail:", JSON.stringify(err.payload, null, 2));
  process.exitCode = 1;
});
