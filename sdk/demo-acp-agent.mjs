#!/usr/bin/env node
/**
 * SpendOS ACP Demo
 * End-to-end Virtuals ACP flow:
 *   1. Health check
 *   2. Agent status
 *   3. check_job  — policy gate before paying
 *   4. acp_topup  — vault → ACP wallet USDC transfer
 */

import { SpendOS } from "./spendos-agent.mjs";

const PROXY = process.env.SPENDOS_PROXY_URL || "http://127.0.0.1:4191";
const AGENT = process.env.SPENDOS_AGENT || "research-agent";
const ACP_WALLET = process.env.SPENDOS_ACP_WALLET || "";
const TOPUP_AMOUNT = Number(process.env.ACP_TOPUP_AMOUNT || "2");
const JOB_AMOUNT = Number(process.env.ACP_JOB_AMOUNT || "2");
const JOB_DESC = process.env.ACP_JOB_DESC || "Trend report for AI agent payment infrastructure on Base blockchain";
const DATAMINER = process.env.ACP_PROVIDER || "0x6ea29564e2045f83b0cc31d416e33d8752ba8105";

const spendos = new SpendOS({ baseUrl: PROXY, agent: AGENT });

function section(label) {
  console.log(`\n── ${label} ${"─".repeat(Math.max(0, 52 - label.length))}`);
}

function ok(msg) { console.log(`  ✓ ${msg}`); }
function fail(msg) { console.log(`  ✗ ${msg}`); }

async function run() {
  console.log("\n╔══════════════════════════════════════════════════╗");
  console.log("║     SpendOS × Virtuals ACP — Demo Flow          ║");
  console.log("╚══════════════════════════════════════════════════╝");
  console.log(`  Proxy      : ${PROXY}`);
  console.log(`  Agent      : ${AGENT}`);
  console.log(`  ACP wallet : ${ACP_WALLET || "(from proxy state)"}`);
  console.log(`  Job amount : ${JOB_AMOUNT} USDC`);
  console.log(`  Top-up     : ${TOPUP_AMOUNT} USDC\n`);

  // 1. Health
  section("1. Proxy health");
  const health = await spendos.health().catch(() => null);
  if (!health) { fail("Proxy offline — start with: bash start.sh"); process.exit(1); }
  ok(`Proxy online — ${new Date().toISOString()}`);

  // 2. Agent status
  section("2. Agent status");
  const agent = await spendos.getAgent();
  console.log(`  Balance    : ${agent.balance} USDC`);
  console.log(`  Spent today: ${agent.spentToday} USDC`);
  console.log(`  Daily limit: ${agent.dailyLimit} USDC`);
  console.log(`  Per-tx cap : ${agent.perTransactionLimit} USDC`);
  console.log(`  ACP wallet : ${agent.acpWallet || "not linked"}`);

  if (agent.balance < JOB_AMOUNT) {
    fail(`Insufficient vault balance (${agent.balance} USDC < ${JOB_AMOUNT} USDC)`);
    console.log("  Fund vault: node scripts/vault-admin.mjs --env-file=.env.local fund --amount 10");
    process.exit(1);
  }

  const resolvedAcpWallet = ACP_WALLET || agent.acpWallet;
  if (!resolvedAcpWallet) {
    fail("ACP wallet not linked. Run: POST /v1/acp/link_wallet");
    process.exit(1);
  }

  // 3. check_job — policy gate
  section("3. ACP check_job (policy gate)");
  console.log(`  Provider   : ${DATAMINER}`);
  console.log(`  Checking job for ${JOB_AMOUNT} USDC...`);
  const checkResult = await spendos.checkAcpJob({
    acpWallet: resolvedAcpWallet,
    amount: JOB_AMOUNT,
    provider: DATAMINER,
    memo: JOB_DESC,
  });
  console.log(`  Status     : ${checkResult.status}`);
  console.log(`  Risk score : ${checkResult.risk?.score ?? "—"}`);
  if (checkResult.reason) console.log(`  Reason     : ${checkResult.reason}`);

  if (checkResult.status !== "approved") {
    fail(`Job blocked by policy: ${checkResult.reason || checkResult.status}`);
    process.exit(1);
  }
  ok("Job approved by policy engine");

  // 4. acp_topup — vault → ACP wallet
  section("4. ACP top-up (vault → ACP wallet)");
  console.log(`  Sending ${TOPUP_AMOUNT} USDC → ${resolvedAcpWallet.slice(0, 10)}...`);
  const topupResult = await spendos.acpTopup({
    acpWallet: resolvedAcpWallet,
    amount: TOPUP_AMOUNT,
    task: `ACP job top-up: ${JOB_DESC}`,
    submit: true,
  });
  console.log(`  Status     : ${topupResult.status}`);
  if (topupResult.txHash) console.log(`  Tx hash    : ${topupResult.txHash}`);
  console.log(`  ACP wallet : ${topupResult.acp?.wallet ?? resolvedAcpWallet}`);

  if (!["submitted", "approved"].includes(topupResult.status)) {
    fail(`Top-up failed: ${topupResult.reason || topupResult.status}`);
    process.exit(1);
  }
  const onchain = topupResult.status === "submitted";
  ok(`Top-up ${onchain ? "on-chain confirmed" : "authorized (off-chain)"} — ${TOPUP_AMOUNT} USDC`);

  // Summary
  section("Summary");
  const after = await spendos.getAgent().catch(() => null);
  console.log(`  Vault balance after : ${after?.balance ?? "—"} USDC`);
  console.log(`  Spent today         : ${after?.spentToday ?? "—"} USDC`);
  console.log(`  ACP wallet funded   : ${resolvedAcpWallet}`);
  if (topupResult.txHash) {
    console.log(`  Basescan            : https://basescan.org/tx/${topupResult.txHash}`);
  }
  console.log("\n  Next: acp client create-job --offering-name trendReport --provider-address <DataMiner>");
  console.log("        --requirements '{\"industry\":\"AI\",\"timeframe\":\"2026\"}' --chain-id 8453\n");
}

run().catch((err) => {
  console.error("\n  ✗ ERROR:", err.message);
  if (err.payload) console.error("  Detail:", JSON.stringify(err.payload, null, 2));
  process.exitCode = 1;
});
