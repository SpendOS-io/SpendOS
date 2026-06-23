import assert from "node:assert/strict";
import { createServer } from "node:http";
import test, { beforeEach } from "node:test";

import { handleRequest, resetProxyState } from "../backend/spendos-proxy.mjs";
import { SpendOS, SpendOSError } from "../sdk/spendos-agent.mjs";

const ACP_WALLET = "0x52908400098527886E0F7030069857D2E4169EE7";
const PROVIDER = "0x8617E340B3D01FA5F11F306F4090FD50E238070D";

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

test("SpendOS SDK runs the full ACP link, check-job, and top-up flow", async () => {
  await withServer(async (baseUrl) => {
    const spendos = new SpendOS({ baseUrl, agent: "research-agent" });

    const linked = await spendos.linkAcpWallet({
      acpWallet: ACP_WALLET,
      acpProviders: [PROVIDER],
    });
    const jobCheck = await spendos.checkAcpJob({
      provider: PROVIDER,
      amount: 0.2,
      memo: "hire wallet analysis specialist",
    });
    const topup = await spendos.acpTopup({
      amount: 0.2,
      task: "fund ACP escrow for wallet analysis job",
    });
    const receipts = await spendos.getReceipts();

    assert.equal(linked.status, "linked");
    assert.equal(linked.acpWallet, ACP_WALLET);
    assert.equal(jobCheck.status, "approved");
    assert.equal(jobCheck.reason, "acp_job_within_policy");
    assert.equal(topup.status, "approved");
    assert.equal(topup.settlement.args.recipient, ACP_WALLET);
    assert.equal(topup.settlement.args.service, "acp-topup");
    assert.ok(receipts.receipts.some((receipt) => receipt.domain === "acp-topup"));
  });
});

test("SpendOS SDK surfaces unlinked ACP wallet as a blocked top-up", async () => {
  await withServer(async (baseUrl) => {
    const spendos = new SpendOS({ baseUrl, agent: "research-agent" });

    const topup = await spendos.acpTopup({ amount: 0.1, task: "no wallet yet" });

    assert.equal(topup.status, "blocked");
    assert.equal(topup.reason, "acp_wallet_not_linked");
  });
});

test("SpendOS SDK blocks ACP jobs from non-allowlisted providers", async () => {
  await withServer(async (baseUrl) => {
    const spendos = new SpendOS({ baseUrl, agent: "research-agent" });

    await spendos.linkAcpWallet({ acpWallet: ACP_WALLET, acpProviders: [ACP_WALLET] });
    const jobCheck = await spendos.checkAcpJob({ provider: PROVIDER, amount: 0.1 });

    assert.equal(jobCheck.status, "blocked");
    assert.equal(jobCheck.reason, "provider_not_allowlisted");
  });
});

test("SpendOS SDK surfaces live top-up readiness errors", async () => {
  await withServer(async (baseUrl) => {
    const spendos = new SpendOS({ baseUrl, agent: "research-agent" });

    await spendos.linkAcpWallet({ acpWallet: ACP_WALLET });

    await assert.rejects(
      () => spendos.acpTopup({ amount: 0.1, task: "live submit", submit: true }),
      (error) => {
        assert.ok(error instanceof SpendOSError);
        assert.equal(error.status, 503);
        assert.equal(error.message, "vault_address_not_configured");
        return true;
      },
    );
  });
});

test("SpendOS SDK rejects invalid ACP wallet addresses", async () => {
  await withServer(async (baseUrl) => {
    const spendos = new SpendOS({ baseUrl, agent: "research-agent" });

    await assert.rejects(
      () => spendos.linkAcpWallet({ acpWallet: "0xnope" }),
      (error) => {
        assert.ok(error instanceof SpendOSError);
        assert.equal(error.status, 400);
        assert.equal(error.message, "invalid_acp_wallet");
        return true;
      },
    );
  });
});
