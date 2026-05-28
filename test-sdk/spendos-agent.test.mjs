import assert from "node:assert/strict";
import { createServer } from "node:http";
import test, { beforeEach } from "node:test";

import { handleRequest, resetProxyState } from "../backend/spendos-proxy.mjs";
import { SpendOS, SpendOSError } from "../sdk/spendos-agent.mjs";

beforeEach(() => {
  resetProxyState();
});

async function withServer(fn) {
  const server = createServer(handleRequest);
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });

  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  try {
    await fn(baseUrl);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

test("SpendOS SDK checks health and loads agent metadata", async () => {
  await withServer(async (baseUrl) => {
    const spendos = new SpendOS({ baseUrl, agent: "research-agent" });

    const health = await spendos.health();
    const agent = await spendos.getAgent();
    const settlementConfig = await spendos.getSettlementConfig();
    const vaultStatus = await spendos.getVaultStatus();
    const launchReadiness = await spendos.getLaunchReadiness();

    assert.equal(health.status, "ok");
    assert.equal(agent.agentId, "research-agent");
    assert.equal(agent.asset, "USDC");
    assert.match(agent.policyDigest, /^0x[a-f0-9]{64}$/);
    assert.equal(settlementConfig.functionSelector, "0xe79d5d2a");
    assert.equal(vaultStatus.status, "not_configured");
    assert.equal(launchReadiness.status, "not_ready");
    assert.equal(launchReadiness.score.total, 7);
  });
});

test("SpendOS SDK performs budget, policy, x402, and receipt flow", async () => {
  await withServer(async (baseUrl) => {
    const spendos = new SpendOS({ baseUrl, agent: "research-agent" });

    const budget = await spendos.requestBudget({
      task: "Analyze this wallet",
      maxSpend: 0.42,
    });
    const decision = await spendos.checkPolicy({
      domain: "api.tokensight.io",
      contract: "0x8335...2913",
      amount: 0.05,
      task: "SDK price check",
    });
    const preview = await spendos.previewSettlement({
      domain: "api.tokensight.io",
      contract: "0x8335...2913",
      amount: 0.05,
      task: "SDK price check",
    });
    const preflight = await spendos.preflightSettlement({
      domain: "api.tokensight.io",
      contract: "0x8335...2913",
      amount: 0.05,
      task: "SDK price check",
    });
    const payment = await spendos.payX402({
      domain: "api.tokensight.io",
      contract: "0x8335...2913",
      amount: 0.05,
      task: "SDK price check",
    });
    const receipts = await spendos.getReceipts();

    assert.equal(budget.status, "approved");
    assert.equal(decision.status, "approved");
    assert.equal(preview.status, "approved");
    assert.match(preview.settlement.transaction.data, /^0x[a-fA-F0-9]+$/);
    assert.equal(preflight.status, "not_configured");
    assert.equal(preflight.reason, "vault_address_not_configured");
    assert.match(preflight.settlement.transaction.data, /^0x[a-fA-F0-9]+$/);
    assert.equal(payment.status, "approved");
    assert.equal(payment.settlement.function, "spendUSDC");
    assert.ok(receipts.receipts.some((receipt) => receipt.task === "SDK price check"));
  });
});

test("SpendOS SDK updates live agent policy", async () => {
  await withServer(async (baseUrl) => {
    const spendos = new SpendOS({ baseUrl, agent: "research-agent" });

    const update = await spendos.updatePolicy({
      dailyLimit: 14,
      perTransactionLimit: 0.31,
      domains: ["api.tokensight.io", "sdk.newpaid.base"],
      contracts: ["0x8335...2913", "0xabc1...0001"],
      riskMode: "strict",
    });
    const decision = await spendos.checkPolicy({
      domain: "sdk.newpaid.base",
      contract: "0xabc1...0001",
      amount: 0.3,
      task: "SDK policy sync check",
    });

    assert.equal(update.status, "updated");
    assert.equal(update.policy.riskMode, "strict");
    assert.equal(decision.status, "approved");
  });
});

test("SpendOS SDK surfaces settlement submit readiness errors", async () => {
  await withServer(async (baseUrl) => {
    const spendos = new SpendOS({ baseUrl, agent: "research-agent" });

    await assert.rejects(
      () =>
        spendos.submitSettlement({
          domain: "api.tokensight.io",
          contract: "0x8335...2913",
          amount: 0.05,
          task: "SDK submit check",
        }),
      (error) => {
        assert.ok(error instanceof SpendOSError);
        assert.equal(error.status, 503);
        assert.equal(error.message, "vault_address_not_configured");
        assert.equal(error.payload.status, "not_configured");
        return true;
      },
    );
  });
});

test("SpendOS SDK can replay idempotent x402 payments", async () => {
  await withServer(async (baseUrl) => {
    const spendos = new SpendOS({ baseUrl, agent: "research-agent" });
    const payload = {
      domain: "api.tokensight.io",
      contract: "0x8335...2913",
      amount: 0.01,
      task: "SDK idempotent check",
      idempotencyKey: "sdk-idem-1",
    };

    const first = await spendos.payX402(payload);
    const second = await spendos.payX402(payload);

    assert.equal(first.status, "approved");
    assert.equal(first.replayed, false);
    assert.equal(second.status, "approved");
    assert.equal(second.replayed, true);
    assert.equal(second.receipt.receiptHash, first.receipt.receiptHash);
  });
});

test("SpendOS SDK handles approval queue lifecycle", async () => {
  await withServer(async (baseUrl) => {
    const spendos = new SpendOS({ baseUrl, agent: "research-agent" });

    const pending = await spendos.payX402({
      domain: "deepindex.baseops.ai",
      contract: "0x4200...0006",
      amount: 0.44,
      task: "SDK approval required",
    });
    const approvals = await spendos.getApprovals({ status: "pending" });
    const approved = await spendos.resolveApproval({
      approvalId: pending.approval.id,
      decision: "approved",
      resolver: "sdk-test",
    });

    assert.equal(pending.status, "pending");
    assert.equal(approvals.approvals.length, 1);
    assert.equal(approved.status, "approved");
    assert.equal(approved.receipt.status, "approved");
    assert.match(approved.x402.header, /^X-PAYMENT: spendos:0x/);
  });
});

test("SpendOS SDK supports pause and resume controls", async () => {
  await withServer(async (baseUrl) => {
    const spendos = new SpendOS({ baseUrl, agent: "market-sentinel" });

    const paused = await spendos.pauseAgent();
    const blocked = await spendos.checkPolicy({
      domain: "depth.signalbase.com",
      contract: "0x8335...2913",
      amount: 0.1,
      task: "paused check",
    });
    const resumed = await spendos.resumeAgent();

    assert.equal(paused.status, "paused");
    assert.equal(blocked.status, "blocked");
    assert.equal(blocked.reason, "agent_paused");
    assert.equal(resumed.status, "active");
  });
});

test("SpendOS SDK surfaces API errors", async () => {
  await withServer(async (baseUrl) => {
    const spendos = new SpendOS({ baseUrl, agent: "missing-agent" });

    await assert.rejects(() => spendos.getAgent(), (error) => {
      assert.ok(error instanceof SpendOSError);
      assert.equal(error.status, 404);
      assert.equal(error.message, "unknown_agent");
      return true;
    });
  });
});
