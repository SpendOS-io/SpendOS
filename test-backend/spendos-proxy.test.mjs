import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test, { beforeEach } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

import {
  agents,
  approvalList,
  approvals,
  checkPolicy,
  launchReadiness,
  payX402,
  policyDigest,
  receipts,
  requestBudget,
  resetProxyState,
  resolveApproval,
  settlementConfigStatus,
  settlementConfigSnapshot,
  settlementPreflight,
  settlementPreview,
  submitSettlement,
  updateAgentPolicy,
  vaultStatus,
} from "../backend/spendos-proxy.mjs";

const projectRoot = fileURLToPath(new URL("..", import.meta.url));
const proxyModuleUrl = pathToFileURL(join(projectRoot, "backend/spendos-proxy.mjs")).href;

beforeEach(() => {
  resetProxyState();
});

test("checkPolicy approves allowlisted request under limits", () => {
  const decision = checkPolicy("research-agent", {
    domain: "api.tokensight.io",
    contract: "0x8335...2913",
    amount: 0.12,
    task: "market data lookup",
  });

  assert.equal(decision.status, "approved");
  assert.equal(decision.reason, "policy_matched");
});

test("checkPolicy blocks unknown domains", () => {
  const decision = checkPolicy("research-agent", {
    domain: "unknown-indexer.ai",
    contract: "0x8335...2913",
    amount: 0.12,
    task: "wallet clustering",
  });

  assert.equal(decision.status, "blocked");
  assert.equal(decision.reason, "domain_not_allowlisted");
  assert.ok(decision.risk.reasons.includes("domain_not_allowlisted"));
});

test("checkPolicy moves above transaction limit to pending", () => {
  const decision = checkPolicy("research-agent", {
    domain: "deepindex.baseops.ai",
    contract: "0x4200...0006",
    amount: 0.44,
    task: "deep wallet clustering",
  });

  assert.equal(decision.status, "pending");
  assert.equal(decision.reason, "owner_approval_required");
});

test("requestBudget blocks requests above remaining daily limit", () => {
  const result = requestBudget("contract-decoder", {
    task: "large decode batch",
    maxSpend: 10,
  });

  assert.equal(result.status, "blocked");
  assert.equal(result.reason, "daily_limit_exceeded");
});

test("payX402 creates receipt and settlement payload for approved spend", () => {
  const beforeBalance = agents["research-agent"].balance;
  const result = payX402("research-agent", {
    domain: "api.tokensight.io",
    contract: "0x8335...2913",
    amount: 0.05,
    task: "small price refresh",
    recipient: "0x000000000000000000000000000000000000BEEF",
  });

  assert.equal(result.status, "approved");
  assert.match(result.x402.header, /^X-PAYMENT: spendos:0x/);
  assert.equal(result.settlement.function, "spendUSDC");
  assert.notEqual(result.settlement.args.agentVault, "0x0000000000000000000000000000000000000000");
  assert.equal(result.settlement.args.amount, 50000);
  assert.equal(result.settlement.args.service, "api.tokensight.io");
  assert.match(result.settlement.transaction.data, /^0x[a-fA-F0-9]+$/);
  assert.equal(result.settlement.transaction.functionSelector.length, 10);
  assert.equal(result.settlement.transaction.value, "0");
  assert.equal(agents["research-agent"].balance, Number((beforeBalance - 0.05).toFixed(6)));
});

test("payX402 idempotency key prevents duplicate spend", () => {
  const beforeBalance = agents["research-agent"].balance;
  const payload = {
    domain: "api.tokensight.io",
    contract: "0x8335...2913",
    amount: 0.02,
    task: "idempotent price refresh",
    idempotencyKey: "idem-pay-1",
  };

  const first = payX402("research-agent", payload);
  const second = payX402("research-agent", payload);

  assert.equal(first.status, "approved");
  assert.equal(first.replayed, false);
  assert.equal(second.status, "approved");
  assert.equal(second.replayed, true);
  assert.equal(second.receipt.receiptHash, first.receipt.receiptHash);
  assert.equal(agents["research-agent"].balance, Number((beforeBalance - 0.02).toFixed(6)));
});

test("payX402 blocks idempotency key reuse with different payload", () => {
  const beforeBalance = agents["research-agent"].balance;
  const first = payX402("research-agent", {
    domain: "api.tokensight.io",
    contract: "0x8335...2913",
    amount: 0.02,
    task: "idempotent conflict",
    idempotencyKey: "idem-pay-conflict",
  });
  const second = payX402("research-agent", {
    domain: "api.tokensight.io",
    contract: "0x8335...2913",
    amount: 0.03,
    task: "idempotent conflict",
    idempotencyKey: "idem-pay-conflict",
  });

  assert.equal(first.status, "approved");
  assert.equal(second.status, "blocked");
  assert.equal(second.reason, "idempotency_key_conflict");
  assert.equal(agents["research-agent"].balance, Number((beforeBalance - 0.02).toFixed(6)));
});

test("payX402 creates approval request for spend above transaction limit", () => {
  const beforeBalance = agents["research-agent"].balance;
  const result = payX402("research-agent", {
    domain: "deepindex.baseops.ai",
    contract: "0x4200...0006",
    amount: 0.44,
    task: "approval required spend",
  });

  assert.equal(result.status, "pending");
  assert.equal(result.reason, "owner_approval_required");
  assert.equal(result.approval.status, "pending");
  assert.equal(result.receipt.status, "pending");
  assert.equal(approvals.length, 1);
  assert.equal(approvalList({ agentId: "research-agent", status: "pending" }).length, 1);
  assert.equal(agents["research-agent"].balance, beforeBalance);
});

test("resolveApproval approves pending spend once", () => {
  const beforeBalance = agents["research-agent"].balance;
  const pending = payX402("research-agent", {
    domain: "deepindex.baseops.ai",
    contract: "0x4200...0006",
    amount: 0.44,
    task: "owner approved spend",
  });

  const first = resolveApproval(pending.approval.id, {
    decision: "approved",
    resolver: "owner-test",
    signature: "0xsig",
  });
  const second = resolveApproval(pending.approval.id, {
    decision: "approved",
    resolver: "owner-test",
    signature: "0xsig",
  });

  assert.equal(first.status, "approved");
  assert.equal(first.receipt.status, "approved");
  assert.match(first.x402.header, /^X-PAYMENT: spendos:0x/);
  assert.equal(first.settlement.function, "spendUSDC");
  assert.equal(second.replayed, true);
  assert.equal(agents["research-agent"].balance, Number((beforeBalance - 0.44).toFixed(6)));
});

test("resolveApproval denies pending spend without mutating balance", () => {
  const beforeBalance = agents["research-agent"].balance;
  const pending = payX402("research-agent", {
    domain: "deepindex.baseops.ai",
    contract: "0x4200...0006",
    amount: 0.44,
    task: "owner denied spend",
  });
  const denied = resolveApproval(pending.approval.id, {
    decision: "denied",
    reason: "owner_denied_endpoint",
  });

  assert.equal(denied.status, "denied");
  assert.equal(denied.receipt.status, "blocked");
  assert.equal(denied.receipt.reason, "owner_denied_endpoint");
  assert.equal(agents["research-agent"].balance, beforeBalance);
});

test("settlementPreview returns encoded calldata without mutating balance", () => {
  const beforeBalance = agents["research-agent"].balance;
  const result = settlementPreview("research-agent", {
    domain: "api.tokensight.io",
    contract: "0x8335...2913",
    amount: 0.04,
    task: "preview only",
  });

  assert.equal(result.status, "approved");
  assert.equal(result.settlement.function, "spendUSDC");
  assert.equal(result.settlement.args.amount, 40000);
  assert.match(result.settlement.transaction.data, /^0x[a-fA-F0-9]+$/);
  assert.equal(agents["research-agent"].balance, beforeBalance);
});

test("settlementPreflight reports missing vault config safely", async () => {
  const result = await settlementPreflight("research-agent", {
    domain: "api.tokensight.io",
    contract: "0x8335...2913",
    amount: 0.04,
    task: "preflight without env",
  });

  assert.equal(result.status, "not_configured");
  assert.equal(result.reason, "vault_address_not_configured");
  assert.match(result.settlement.transaction.data, /^0x[a-fA-F0-9]+$/);
});

test("settlementPreflight does not call chain for blocked policy", async () => {
  let calls = 0;
  const provider = {
    async call() {
      calls += 1;
      return "0x";
    },
    async estimateGas() {
      calls += 1;
      return 21000n;
    },
  };

  const result = await settlementPreflight(
    "research-agent",
    {
      domain: "unknown-indexer.ai",
      contract: "0x8335...2913",
      amount: 0.04,
      task: "blocked preflight",
    },
    {
      provider,
      vaultAddress: "0x000000000000000000000000000000000000BEEF",
      operatorAddress: "0x0000000000000000000000000000000000000001",
    },
  );

  assert.equal(result.status, "blocked");
  assert.equal(result.reason, "domain_not_allowlisted");
  assert.equal(calls, 0);
});

test("settlementPreflight executes injected eth_call without mutating state", async () => {
  const beforeBalance = agents["research-agent"].balance;
  const beforeReceipts = receipts.length;
  const calls = [];
  const provider = {
    async call(tx) {
      calls.push(tx);
      return "0x";
    },
    async estimateGas() {
      return 123456n;
    },
  };

  const result = await settlementPreflight(
    "research-agent",
    {
      domain: "api.tokensight.io",
      contract: "0x8335...2913",
      amount: 0.04,
      task: "passing preflight",
    },
    {
      provider,
      vaultAddress: "0x000000000000000000000000000000000000BEEF",
      operatorAddress: "0x0000000000000000000000000000000000000001",
    },
  );

  assert.equal(result.status, "ready");
  assert.equal(result.reason, "preflight_passed");
  assert.equal(result.call.ok, true);
  assert.equal(result.call.gasEstimate, "123456");
  assert.equal(calls.length, 1);
  assert.equal(calls[0].to, "0x000000000000000000000000000000000000bEEF");
  assert.match(calls[0].data, /^0x[a-fA-F0-9]+$/);
  assert.equal(agents["research-agent"].balance, beforeBalance);
  assert.equal(receipts.length, beforeReceipts);
});

test("settlementPreflight surfaces simulated reverts", async () => {
  const provider = {
    async call() {
      const error = new Error("execution reverted: NotAuthorizedOperator");
      error.code = "CALL_EXCEPTION";
      error.reason = "NotAuthorizedOperator";
      throw error;
    },
    async estimateGas() {
      return 0n;
    },
  };

  const result = await settlementPreflight(
    "research-agent",
    {
      domain: "api.tokensight.io",
      contract: "0x8335...2913",
      amount: 0.04,
      task: "reverting preflight",
    },
    {
      provider,
      vaultAddress: "0x000000000000000000000000000000000000BEEF",
      operatorAddress: "0x0000000000000000000000000000000000000001",
    },
  );

  assert.equal(result.status, "would_revert");
  assert.equal(result.reason, "NotAuthorizedOperator");
  assert.equal(result.call.ok, false);
  assert.equal(result.call.code, "CALL_EXCEPTION");
});

test("submitSettlement reports missing vault config safely", async () => {
  const result = await submitSettlement("research-agent", {
    domain: "api.tokensight.io",
    contract: "0x8335...2913",
    amount: 0.04,
    task: "submit without env",
  });

  assert.equal(result.status, "not_configured");
  assert.equal(result.reason, "vault_address_not_configured");
  assert.equal(result.config.vaultReady, false);
  assert.match(result.settlement.transaction.data, /^0x[a-fA-F0-9]+$/);
});

test("submitSettlement can use an injected signer", async () => {
  const beforeBalance = agents["research-agent"].balance;
  const sent = [];
  const signer = {
    async sendTransaction(tx) {
      sent.push(tx);
      return { hash: "0x" + "1".repeat(64) };
    },
  };

  const result = await submitSettlement(
    "research-agent",
    {
      domain: "api.tokensight.io",
      contract: "0x8335...2913",
      amount: 0.03,
      task: "mock signer submit",
    },
    { signer, vaultAddress: "0x000000000000000000000000000000000000BEEF" },
  );

  assert.equal(result.status, "submitted");
  assert.equal(result.txHash, "0x" + "1".repeat(64));
  assert.equal(sent.length, 1);
  assert.equal(sent[0].to, "0x000000000000000000000000000000000000bEEF");
  assert.match(sent[0].data, /^0x[a-fA-F0-9]+$/);
  assert.equal(agents["research-agent"].balance, Number((beforeBalance - 0.03).toFixed(6)));
});

test("submitSettlement idempotency key replays submitted tx without resending", async () => {
  const sent = [];
  const signer = {
    async sendTransaction(tx) {
      sent.push(tx);
      return { hash: "0x" + "2".repeat(64) };
    },
  };
  const payload = {
    domain: "api.tokensight.io",
    contract: "0x8335...2913",
    amount: 0.01,
    task: "idempotent submit",
    idempotencyKey: "idem-submit-1",
  };

  const first = await submitSettlement("research-agent", payload, {
    signer,
    vaultAddress: "0x000000000000000000000000000000000000BEEF",
  });
  const second = await submitSettlement("research-agent", payload, {
    signer,
    vaultAddress: "0x000000000000000000000000000000000000BEEF",
  });

  assert.equal(first.status, "submitted");
  assert.equal(second.status, "submitted");
  assert.equal(second.replayed, true);
  assert.equal(second.txHash, first.txHash);
  assert.equal(sent.length, 1);
});

test("settlementConfigStatus exposes readiness flags", () => {
  const status = settlementConfigStatus("0x000000000000000000000000000000000000BEEF");

  assert.equal(status.vaultReady, true);
  assert.equal(status.vaultAddress, "0x000000000000000000000000000000000000BEEF");
});

test("settlementConfigSnapshot exposes launch readiness metadata", () => {
  const snapshot = settlementConfigSnapshot("0x000000000000000000000000000000000000BEEF");

  assert.equal(snapshot.status, "not_configured");
  assert.equal(snapshot.chain, "base");
  assert.equal(snapshot.chainId, 8453);
  assert.equal(snapshot.asset, "USDC");
  assert.equal(snapshot.function, "spendUSDC");
  assert.equal(snapshot.functionSelector, "0xe79d5d2a");
  assert.equal(snapshot.config.vaultReady, true);
});

test("settlementConfigSnapshot can load vault metadata from deployment file", () => {
  const tempDir = mkdtempSync(join(tmpdir(), "spendos-deployment-"));
  const deploymentFile = join(tempDir, "base-sepolia-84532.json");

  try {
    writeFileSync(
      deploymentFile,
      JSON.stringify({
        network: "base-sepolia",
        chainId: 84532,
        deployer: "0x0000000000000000000000000000000000000001",
        usdcAddress: "0x000000000000000000000000000000000000CAFE",
        vaultAddress: "0x000000000000000000000000000000000000BEEF",
        vaultTxHash: "0x" + "a".repeat(64),
      }),
    );

    const output = execFileSync(
      process.execPath,
      [
        "--input-type=module",
        "-e",
        `
          import { settlementConfigSnapshot } from ${JSON.stringify(proxyModuleUrl)};
          console.log(JSON.stringify(settlementConfigSnapshot()));
        `,
      ],
      {
        cwd: projectRoot,
        env: { ...process.env, SPENDOS_DEPLOYMENT_FILE: deploymentFile, SPENDOS_STATE_FILE: "memory" },
        encoding: "utf8",
      },
    );
    const snapshot = JSON.parse(output);

    assert.equal(snapshot.chain, "base-sepolia");
    assert.equal(snapshot.chainId, 84532);
    assert.equal(snapshot.vault, "0x000000000000000000000000000000000000BEEF");
    assert.equal(snapshot.usdc, "0x000000000000000000000000000000000000CAFE");
    assert.equal(snapshot.deployment.loaded, true);
    assert.equal(snapshot.deployment.vaultTxHash, "0x" + "a".repeat(64));
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test("vaultStatus reports missing onchain config safely", async () => {
  const status = await vaultStatus("research-agent", {
    vaultAddress: "0x0000000000000000000000000000000000000000",
  });

  assert.equal(status.status, "not_configured");
  assert.equal(status.reason, "vault_address_not_configured");
  assert.equal(status.agentId, "research-agent");
});

test("vaultStatus reads onchain policy through injected contracts", async () => {
  const vaultContract = {
    async policies() {
      return {
        owner: "0x0000000000000000000000000000000000000001",
        availableBalance: 10_000_000n,
        dailyLimit: 5_000_000n,
        perTransactionLimit: 250_000n,
        spentInWindow: 750_000n,
        windowStart: 123n,
        paused: false,
        policyDigest: "0x" + "1".repeat(64),
      };
    },
    async usdc() {
      return "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
    },
    async operators() {
      return false;
    },
  };
  const usdcContract = {
    async balanceOf() {
      return 1_250_000n;
    },
  };

  const status = await vaultStatus("research-agent", {
    vaultAddress: "0x000000000000000000000000000000000000BEEF",
    vaultContract,
    usdcContract,
  });

  assert.equal(status.status, "ready");
  assert.equal(status.policy.availableBalance, "10.0");
  assert.equal(status.policy.perTransactionLimit, "0.25");
  assert.equal(status.walletUSDCBalance, "1.25");
});

test("launchReadiness aggregates missing launch configuration", async () => {
  const readiness = await launchReadiness("research-agent");

  assert.equal(readiness.status, "not_ready");
  assert.equal(readiness.score.total, 7);
  assert.ok(readiness.checks.some((check) => check.id === "vault_address" && check.status === "fail"));
  assert.ok(readiness.nextActions.some((action) => action.includes("SPENDOS_VAULT_ADDRESS")));
});

test("launchReadiness passes with injected vault state and preflight provider", async () => {
  const owner = "0x0000000000000000000000000000000000000001";
  const operator = "0x0000000000000000000000000000000000000002";
  const vaultContract = {
    async policies() {
      return {
        owner,
        availableBalance: 10_000_000n,
        dailyLimit: 5_000_000n,
        perTransactionLimit: 250_000n,
        spentInWindow: 0n,
        windowStart: 123n,
        paused: false,
        policyDigest: "0x" + "1".repeat(64),
      };
    },
    async usdc() {
      return "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
    },
    async operators(policyOwner, policyOperator) {
      return policyOwner === owner && policyOperator === operator;
    },
  };
  const usdcContract = {
    async balanceOf() {
      return 1_250_000n;
    },
  };
  const provider = {
    async call() {
      return "0x";
    },
    async estimateGas() {
      return 123456n;
    },
  };

  const readiness = await launchReadiness("research-agent", {
    provider,
    vaultAddress: "0x000000000000000000000000000000000000BEEF",
    vaultContract,
    usdcContract,
    operatorAddress: operator,
  });

  assert.equal(readiness.status, "ready");
  assert.equal(readiness.score.passed, readiness.score.total);
  assert.equal(readiness.vault.operatorAllowed, true);
  assert.equal(readiness.preflight.status, "ready");
  assert.deepEqual(readiness.nextActions, []);
});

test("pauseAgent state blocks policy checks", () => {
  agents["market-sentinel"].paused = true;

  const decision = checkPolicy("market-sentinel", {
    domain: "depth.signalbase.com",
    contract: "0x8335...2913",
    amount: 0.1,
    task: "liquidity check",
  });

  agents["market-sentinel"].paused = false;

  assert.equal(decision.status, "blocked");
  assert.equal(decision.reason, "agent_paused");
});

test("policyDigest changes when policy state changes", () => {
  const agent = agents["contract-decoder"];
  const before = policyDigest("contract-decoder", agent);
  agent.paused = true;
  const after = policyDigest("contract-decoder", agent);
  agent.paused = false;

  assert.notEqual(before, after);
});

test("updateAgentPolicy persists active spend limits and allowlists", () => {
  const updated = updateAgentPolicy("research-agent", {
    dailyLimit: 12,
    perTransactionLimit: 0.33,
    domains: ["api.tokensight.io", "newpaid.base"],
    contracts: ["0x8335...2913", "0x1234...abcd"],
    riskMode: "strict",
  });
  const approved = checkPolicy("research-agent", {
    domain: "newpaid.base",
    contract: "0x1234...abcd",
    amount: 0.32,
    task: "new provider",
  });
  const pending = checkPolicy("research-agent", {
    domain: "newpaid.base",
    contract: "0x1234...abcd",
    amount: 0.34,
    task: "above new cap",
  });

  assert.equal(updated.status, "updated");
  assert.equal(updated.policy.dailyLimit, 12);
  assert.equal(updated.policy.perTransactionLimit, 0.33);
  assert.equal(updated.policy.riskMode, "strict");
  assert.equal(approved.status, "approved");
  assert.equal(pending.status, "pending");
});

test("updateAgentPolicy rejects invalid policy payloads", () => {
  assert.throws(
    () =>
      updateAgentPolicy("research-agent", {
        dailyLimit: 0,
      }),
    /invalid_daily_limit/,
  );
  assert.throws(
    () =>
      updateAgentPolicy("research-agent", {
        domains: "api.tokensight.io",
      }),
    /invalid_domains/,
  );
});

test("persistent state survives proxy process restart", () => {
  const tempDir = mkdtempSync(join(tmpdir(), "spendos-state-"));
  const stateFile = join(tempDir, "state.json");

  try {
    const createOutput = execFileSync(
      process.execPath,
      [
        "--input-type=module",
        "-e",
        `
          import { agents, payX402, receipts } from ${JSON.stringify(proxyModuleUrl)};
          const result = payX402("research-agent", {
            domain: "api.tokensight.io",
            contract: "0x8335...2913",
            amount: 0.05,
            task: "persistent state check",
            idempotencyKey: "persisted-pay-1"
          });
          console.log(JSON.stringify({
            status: result.status,
            receiptCount: receipts.length,
            spentToday: agents["research-agent"].spentToday
          }));
        `,
      ],
      {
        cwd: projectRoot,
        env: { ...process.env, SPENDOS_STATE_FILE: stateFile },
        encoding: "utf8",
      },
    );

    const reloadOutput = execFileSync(
      process.execPath,
      [
        "--input-type=module",
        "-e",
        `
          import { agents, receipts } from ${JSON.stringify(proxyModuleUrl)};
          console.log(JSON.stringify({
            receiptCount: receipts.length,
            spentToday: agents["research-agent"].spentToday,
            task: receipts[0]?.task
          }));
        `,
      ],
      {
        cwd: projectRoot,
        env: { ...process.env, SPENDOS_STATE_FILE: stateFile },
        encoding: "utf8",
      },
    );

    const created = JSON.parse(createOutput);
    const reloaded = JSON.parse(reloadOutput);

    assert.equal(created.status, "approved");
    assert.equal(created.receiptCount, 1);
    assert.equal(reloaded.receiptCount, 1);
    assert.equal(reloaded.task, "persistent state check");
    assert.equal(reloaded.spentToday, created.spentToday);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});
