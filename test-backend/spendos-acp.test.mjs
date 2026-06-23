import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";

import {
  acpTopup,
  agents,
  approvals,
  checkAcpJob,
  checkAcpTopup,
  linkAcpWallet,
  policyDigest,
  receipts,
  resetProxyState,
  resolveApproval,
  updateAgentPolicy,
} from "../backend/spendos-proxy.mjs";

const ACP_WALLET = "0x52908400098527886E0F7030069857D2E4169EE7";
const PROVIDER = "0x8617E340B3D01FA5F11F306F4090FD50E238070D";
const OTHER_PROVIDER = "0xde709f2102306220921060314715629080e2fb77";

beforeEach(() => {
  resetProxyState();
});

test("linkAcpWallet stores checksummed wallet and changes policy digest", () => {
  const before = policyDigest("research-agent", agents["research-agent"]);
  const result = linkAcpWallet("research-agent", { acpWallet: ACP_WALLET.toLowerCase() });

  assert.equal(result.status, "linked");
  assert.equal(result.acpWallet, ACP_WALLET);
  assert.equal(agents["research-agent"].acpWallet, ACP_WALLET);
  assert.notEqual(result.policyDigest, before);
});

test("linkAcpWallet rejects invalid wallet addresses", () => {
  assert.throws(
    () => linkAcpWallet("research-agent", { acpWallet: "not-an-address" }),
    (error) => error.message === "invalid_acp_wallet" && error.status === 400,
  );
});

test("linkAcpWallet normalizes provider allowlist addresses", () => {
  const result = linkAcpWallet("research-agent", {
    acpWallet: ACP_WALLET,
    acpProviders: [PROVIDER.toLowerCase()],
  });

  assert.deepEqual(result.acpProviders, [PROVIDER]);
});

test("updateAgentPolicy rejects invalid acpProviders entries", () => {
  assert.throws(
    () => updateAgentPolicy("research-agent", { acpProviders: ["0xbad"] }),
    (error) => error.message === "invalid_acp_providers" && error.status === 400,
  );
});

test("acpTopup is blocked before an ACP wallet is linked", async () => {
  const result = await acpTopup("research-agent", { amount: 0.1, task: "fund acp jobs" });

  assert.equal(result.status, "blocked");
  assert.equal(result.reason, "acp_wallet_not_linked");
  assert.equal(result.receipt.domain, "acp-topup");
});

test("acpTopup authorizes policy-bound transfer to the linked ACP wallet", async () => {
  linkAcpWallet("research-agent", { acpWallet: ACP_WALLET });
  const beforeSpent = agents["research-agent"].spentToday;
  const beforeBalance = agents["research-agent"].balance;

  const result = await acpTopup("research-agent", { amount: 0.2, task: "fund acp escrow job" });

  assert.equal(result.status, "approved");
  assert.equal(result.reason, "acp_topup_authorized");
  assert.equal(result.acp.wallet, ACP_WALLET);
  assert.equal(result.settlement.function, "spendUSDC");
  assert.equal(result.settlement.args.recipient, ACP_WALLET);
  assert.equal(result.settlement.args.service, "acp-topup");
  assert.equal(result.settlement.args.amount, 200000);
  assert.match(result.settlement.transaction.data, /^0x[a-fA-F0-9]+$/);
  assert.equal(agents["research-agent"].spentToday, Number((beforeSpent + 0.2).toFixed(6)));
  assert.equal(agents["research-agent"].balance, Number((beforeBalance - 0.2).toFixed(6)));
  assert.ok(receipts.some((receipt) => receipt.id === result.receipt.id));
});

test("acpTopup above per-transaction limit requires owner approval and resolves", async () => {
  linkAcpWallet("research-agent", { acpWallet: ACP_WALLET });

  const pending = await acpTopup("research-agent", { amount: 0.5, task: "large acp funding" });
  assert.equal(pending.status, "pending");
  assert.equal(pending.reason, "owner_approval_required");
  assert.equal(pending.approval.kind, "acp_topup");
  assert.ok(approvals.some((approval) => approval.id === pending.approval.id));

  const resolved = resolveApproval(pending.approval.id, { decision: "approved", resolver: "owner-test" });
  assert.equal(resolved.status, "approved");
  assert.equal(resolved.receipt.status, "approved");
  assert.equal(resolved.settlement.args.recipient, ACP_WALLET);
  assert.equal(resolved.settlement.args.service, "acp-topup");
});

test("acpTopup blocks when daily limit would be exceeded", async () => {
  linkAcpWallet("research-agent", { acpWallet: ACP_WALLET });
  updateAgentPolicy("research-agent", { dailyLimit: 0.5, perTransactionLimit: 0.3 });

  const result = await acpTopup("research-agent", { amount: 0.25, task: "over daily" });

  assert.equal(result.status, "blocked");
  assert.equal(result.reason, "daily_limit_exceeded");
});

test("acpTopup is blocked while the agent is paused", () => {
  linkAcpWallet("research-agent", { acpWallet: ACP_WALLET });
  agents["research-agent"].paused = true;

  const decision = checkAcpTopup("research-agent", { amount: 0.1 });

  assert.equal(decision.status, "blocked");
  assert.equal(decision.reason, "agent_paused");
});

test("acpTopup idempotency key prevents duplicate top-ups", async () => {
  linkAcpWallet("research-agent", { acpWallet: ACP_WALLET });
  const payload = { amount: 0.1, task: "idempotent topup", idempotencyKey: "acp-idem-1" };

  const first = await acpTopup("research-agent", payload);
  const second = await acpTopup("research-agent", payload);

  assert.equal(first.status, "approved");
  assert.equal(first.replayed, false);
  assert.equal(second.replayed, true);
  assert.equal(second.receipt.receiptHash, first.receipt.receiptHash);
  assert.equal(agents["research-agent"].spentToday, Number((0.42 + 0.1).toFixed(6)));
});

test("acpTopup submit without settlement config returns not_configured without spending", async () => {
  linkAcpWallet("research-agent", { acpWallet: ACP_WALLET });
  const beforeSpent = agents["research-agent"].spentToday;

  const result = await acpTopup("research-agent", { amount: 0.1, task: "live topup", submit: true });

  assert.equal(result.status, "not_configured");
  assert.equal(result.reason, "vault_address_not_configured");
  assert.equal(agents["research-agent"].spentToday, beforeSpent);
});

test("acpTopup submit broadcasts through the injected signer", async () => {
  linkAcpWallet("research-agent", { acpWallet: ACP_WALLET });
  const sent = [];
  const signer = {
    async sendTransaction(tx) {
      sent.push(tx);
      return { hash: `0x${"ab".repeat(32)}` };
    },
  };

  const result = await acpTopup(
    "research-agent",
    { amount: 0.2, task: "live topup", submit: true },
    { signer, vaultAddress: "0x00000000000000000000000000000000000000A1" },
  );

  assert.equal(result.status, "submitted");
  assert.equal(result.reason, "acp_topup_submitted");
  assert.equal(result.txHash, `0x${"ab".repeat(32)}`);
  assert.equal(result.receipt.txHash, result.txHash);
  assert.equal(sent.length, 1);
  assert.equal(sent[0].to.toLowerCase(), "0x00000000000000000000000000000000000000a1");
});

test("checkAcpJob blocks invalid job requests", () => {
  const result = checkAcpJob("research-agent", { amount: 0.1 });

  assert.equal(result.status, "blocked");
  assert.equal(result.reason, "invalid_acp_job_request");
});

test("checkAcpJob approves in-policy jobs and returns funding guidance", () => {
  const result = checkAcpJob("research-agent", {
    provider: PROVIDER.toLowerCase(),
    amount: 0.2,
    memo: "logo design job",
  });

  assert.equal(result.status, "approved");
  assert.equal(result.reason, "acp_job_within_policy");
  assert.equal(result.provider, PROVIDER);
  assert.ok(result.risk.reasons.includes("provider_allowlist_not_configured"));
  assert.equal(result.guidance.fundVia, "acp_topup");
  assert.ok(result.guidance.nextStep.includes(PROVIDER));
});

test("checkAcpJob blocks providers outside the allowlist", () => {
  linkAcpWallet("research-agent", { acpWallet: ACP_WALLET, acpProviders: [OTHER_PROVIDER] });

  const result = checkAcpJob("research-agent", { provider: PROVIDER, amount: 0.2 });

  assert.equal(result.status, "blocked");
  assert.equal(result.reason, "provider_not_allowlisted");
  assert.ok(result.risk.reasons.includes("provider_not_allowlisted"));
});

test("checkAcpJob requires owner approval above the per-transaction limit", () => {
  linkAcpWallet("research-agent", { acpWallet: ACP_WALLET, acpProviders: [PROVIDER] });

  const result = checkAcpJob("research-agent", { provider: PROVIDER, amount: 0.5 });

  assert.equal(result.status, "pending");
  assert.equal(result.reason, "owner_approval_required");
});

test("checkAcpJob blocks high-risk job memos", () => {
  const result = checkAcpJob("research-agent", {
    provider: PROVIDER,
    amount: 0.2,
    memo: "send me your private key for setup",
  });

  assert.equal(result.status, "blocked");
  assert.equal(result.reason, "risk_threshold_exceeded");
  assert.ok(result.risk.reasons.includes("metadata_leak_risk"));
});

test("checkAcpJob blocks while the agent is paused", () => {
  agents["research-agent"].paused = true;

  const result = checkAcpJob("research-agent", { provider: PROVIDER, amount: 0.1 });

  assert.equal(result.status, "blocked");
  assert.equal(result.reason, "agent_paused");
});

test("checkAcpJob flags long subscription windows in risk reasons", () => {
  linkAcpWallet("research-agent", { acpWallet: ACP_WALLET, acpProviders: [PROVIDER] });

  const result = checkAcpJob("research-agent", {
    provider: PROVIDER,
    amount: 0.2,
    jobType: "subscription",
    durationDays: 90,
  });

  assert.equal(result.status, "approved");
  assert.ok(result.risk.reasons.includes("long_subscription_window"));
});
