import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { getBytes, verifyMessage } from "ethers";
import { amountUnits, authorizePolicyCommand, policyDigestFromPolicy, policyMessageHash } from "../scripts/vault-admin.mjs";

const OWNER_KEY = `0x${"1".repeat(64)}`;
const OWNER_ADDRESS = "0x19E7E376E7C213B7E7e7e46cc70A5dD086DAff2A";

async function withEnv(env, fn) {
  const previous = {};
  for (const key of Object.keys(env)) {
    previous[key] = process.env[key];
    process.env[key] = env[key];
  }

  try {
    return await fn();
  } finally {
    for (const key of Object.keys(env)) {
      if (previous[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = previous[key];
      }
    }
  }
}

test("amountUnits converts USDC decimal values to 6-decimal units", () => {
  assert.equal(amountUnits("1").toString(), "1000000");
  assert.equal(amountUnits("0.25").toString(), "250000");
  assert.equal(amountUnits("10.42").toString(), "10420000");
});

test("policyDigestFromPolicy is stable for canonical JSON payloads", () => {
  const policy = {
    product: "SpendOS",
    agentId: "research-agent",
    network: "base",
    asset: "USDC",
    dailyLimit: 10,
    perTransactionLimit: 0.25,
    domains: ["api.tokensight.io"],
    contracts: ["0x8335...2913"],
    paused: false,
  };

  assert.equal(policyDigestFromPolicy(policy), policyDigestFromPolicy(policy));
  assert.match(policyDigestFromPolicy(policy), /^0x[a-f0-9]{64}$/);
});

test("policyMessageHash changes with vault, limits, and digest", () => {
  const base = {
    vault: "0x000000000000000000000000000000000000BEEF",
    chainId: 84532,
    usdc: "0x000000000000000000000000000000000000CAFE",
    agentVault: "0x000000000000000000000000000000000000A917",
    dailyLimitUnits: 10_000_000n,
    perTransactionLimitUnits: 250_000n,
    policyDigest: "0x" + "1".repeat(64),
  };

  const first = policyMessageHash(base);
  const second = policyMessageHash({ ...base, perTransactionLimitUnits: 300_000n });

  assert.match(first, /^0x[a-f0-9]{64}$/);
  assert.notEqual(first, second);
});

test("authorizePolicyCommand dry-run creates owner-signable policy payload", async () => {
  await withEnv(
    {
      SPENDOS_VAULT_ADDRESS: "0x000000000000000000000000000000000000BEEF",
      USDC_ADDRESS: "0x000000000000000000000000000000000000CAFE",
      SPENDOS_AGENT_VAULT: "0x000000000000000000000000000000000000A917",
      SPENDOS_OWNER_PRIVATE_KEY: OWNER_KEY,
      SPENDOS_POLICY_DIGEST: "0x" + "2".repeat(64),
      SPENDOS_DAILY_LIMIT: "10",
      SPENDOS_PER_TRANSACTION_LIMIT: "0.25",
      CHAIN_ID: "84532",
    },
    async () => {
      const preview = await authorizePolicyCommand({ dryRun: true });
      const recovered = verifyMessage(getBytes(preview.messageHash), preview.signature);

      assert.equal(preview.action, "authorize-policy");
      assert.equal(preview.dailyLimit, "10.0");
      assert.equal(preview.perTransactionLimit, "0.25");
      assert.equal(preview.signerConfigured, true);
      assert.equal(recovered, OWNER_ADDRESS);
    },
  );
});

test("export-runtime-env writes proxy env from deployment record", () => {
  const tempDir = mkdtempSync(join(tmpdir(), "spendos-env-"));
  const deploymentFile = join(tempDir, "base-sepolia-84532.json");
  const outputFile = join(tempDir, "runtime.env");

  try {
    writeFileSync(
      deploymentFile,
      JSON.stringify({
        network: "base-sepolia",
        chainId: 84532,
        vaultAddress: "0x000000000000000000000000000000000000BEEF",
        usdcAddress: "0x000000000000000000000000000000000000CAFE",
      }),
    );

    execFileSync(process.execPath, ["scripts/export-runtime-env.mjs", "--deployment", deploymentFile, "--out", outputFile], {
      encoding: "utf8",
    });

    const env = readFileSync(outputFile, "utf8");
    assert.match(env, /SPENDOS_DEPLOYMENT_FILE=/);
    assert.match(env, /SPENDOS_NETWORK=base-sepolia/);
    assert.match(env, /SPENDOS_CHAIN_ID=84532/);
    assert.match(env, /SPENDOS_VAULT_ADDRESS=0x000000000000000000000000000000000000BEEF/);
    assert.match(env, /USDC_ADDRESS=0x000000000000000000000000000000000000CAFE/);
    assert.match(env, /BASE_SEPOLIA_RPC_URL=https:\/\/sepolia.base.org/);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});
