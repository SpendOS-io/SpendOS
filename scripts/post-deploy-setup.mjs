#!/usr/bin/env node
/**
 * SpendOS — Post-deploy automatic vault setup script
 *
 * After deploy, runs in one command:
 *   1. Registers agent vault (registerAgent)
 *   2. Authorizes proxy operator (setOperator)
 *   3. Mints MockUSDC if needed (with --mock-usdc)
 *   4. Funds agent vault (fundAgent)
 *   5. Signs and approves policy (authorizePolicy)
 *   6. Updates .env.local with contract addresses
 *   7. Verifies vault status
 *
 * Usage:
 *   node scripts/post-deploy-setup.mjs
 *   node scripts/post-deploy-setup.mjs --mock-usdc --fund-amount 20
 *   node scripts/post-deploy-setup.mjs --dry-run
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  Contract,
  JsonRpcProvider,
  Wallet,
  formatUnits,
  getAddress,
  getBytes,
  parseUnits,
} from "ethers";

const ROOT = new URL("..", import.meta.url).pathname;

function env(key, fallback = "") {
  return process.env[key] || fallback;
}

function argValue(name, fallback = "") {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] || fallback : fallback;
}

function hasArg(name) {
  return process.argv.includes(name);
}

function readJson(path) {
  if (!existsSync(path)) throw new Error(`File not found: ${path}`);
  return JSON.parse(readFileSync(path, "utf8"));
}

function readArtifact(name) {
  return readJson(join(ROOT, "artifacts", `${name}.json`));
}

function latestDeploymentFile() {
  const network = env("SPENDOS_DEPLOY_NETWORK", "base-sepolia");
  const chainId  = network === "base" ? "8453" : "84532";
  return join(ROOT, "deployments", `${network}-${chainId}.json`);
}

async function step(label, fn) {
  process.stdout.write(`  ${label} ... `);
  try {
    const result = await fn();
    console.log("✓");
    return result;
  } catch (err) {
    console.log(`✗  ${err.message}`);
    throw err;
  }
}

async function main() {
  const dryRun    = hasArg("--dry-run");
  const useMock   = hasArg("--mock-usdc");
  const fundAmt   = argValue("--fund-amount", "10");
  const mintAmt   = argValue("--mint-amount", "50");
  const network   = env("SPENDOS_DEPLOY_NETWORK", "base-sepolia");
  const rpcUrl    = env("BASE_SEPOLIA_RPC_URL", "https://sepolia.base.org");
  const privKey   = env("PRIVATE_KEY") || env("SPENDOS_DEPLOYER_PRIVATE_KEY");
  const operator  = env("SPENDOS_OPERATOR_ADDRESS");
  const agentVault = env("SPENDOS_AGENT_VAULT");
  const dailyLim  = env("SPENDOS_DAILY_LIMIT", "10");
  const txLim     = env("SPENDOS_PER_TRANSACTION_LIMIT", "0.25");

  console.log("\n╔══════════════════════════════════════════════════════════════╗");
  console.log("║             SpendOS — Post-Deploy Vault Setup               ║");
  console.log("╚══════════════════════════════════════════════════════════════╝");
  console.log(`  Network    : ${network}`);
  console.log(`  Dry-run    : ${dryRun}`);
  console.log(`  Mock USDC  : ${useMock}`);
  console.log(`  Fund amt   : ${fundAmt} USDC`);
  console.log(`  Agent vault: ${agentVault || "ENV MISSING"}`);
  console.log(`  Operator   : ${operator || "ENV MISSING"}`);
  console.log("");

  if (!privKey)    throw new Error("PRIVATE_KEY missing — check .env.local");
  if (!agentVault) throw new Error("SPENDOS_AGENT_VAULT missing — check .env.local");
  if (!operator)   throw new Error("SPENDOS_OPERATOR_ADDRESS missing — check .env.local");

  const deploymentPath = latestDeploymentFile();
  if (!existsSync(deploymentPath)) {
    throw new Error(
      `Deployment file not found: ${deploymentPath}\n` +
      "  Run deploy first:\n" +
      "  node scripts/deploy-spendos-vault.mjs --network base-sepolia --mock-usdc"
    );
  }

  const deployment = readJson(deploymentPath);
  const vaultAddr  = getAddress(deployment.vaultAddress);
  const usdcAddr   = getAddress(useMock ? deployment.mockUSDC?.address || deployment.usdcAddress : deployment.usdcAddress);

  console.log(`  Vault addr : ${vaultAddr}`);
  console.log(`  USDC addr  : ${usdcAddr}`);
  console.log("");

  if (dryRun) {
    console.log("  [DRY-RUN] No real transactions will be made. ENV and deployment files OK.\n");
    return;
  }

  const vaultAbi   = readArtifact("SpendOSVault").abi;
  const usdcAbi    = readArtifact("MockUSDC").abi;
  const provider   = new JsonRpcProvider(rpcUrl);
  const wallet     = new Wallet(privKey, provider);
  const owner      = await wallet.getAddress();
  const vault      = new Contract(vaultAddr, vaultAbi, wallet);
  const usdc       = new Contract(usdcAddr, usdcAbi, wallet);
  const chainId    = Number((await provider.getNetwork()).chainId);

  console.log(`  Owner addr : ${owner}`);
  console.log(`  Chain ID   : ${chainId}`);
  console.log("");
  console.log("  ── Steps ───────────────────────────────────────────────────");

  // 1. Register agent vault
  let alreadyRegistered = false;
  await step("Check agent vault registration", async () => {
    const policy = await vault.policies(getAddress(agentVault));
    alreadyRegistered = policy.owner !== "0x0000000000000000000000000000000000000000";
  });

  if (!alreadyRegistered) {
    await step("Call registerAgent", async () => {
      const tx = await vault.registerAgent(getAddress(agentVault));
      await tx.wait();
    });
  } else {
    console.log("  Agent vault already registered — skipped");
  }

  // 2. Set operator
  await step("setOperator — authorize proxy", async () => {
    const tx = await vault.setOperator(getAddress(operator), true);
    await tx.wait();
  });

  // 3. Mint mock USDC if needed
  if (useMock) {
    await step(`mint mock USDC (${mintAmt} USDC → owner)`, async () => {
      const tx = await usdc.mint(owner, parseUnits(mintAmt, 6));
      await tx.wait();
    });
  }

  // 4. Approve + fund agent vault
  await step(`USDC approve (${fundAmt} USDC)`, async () => {
    const tx = await usdc.approve(vaultAddr, parseUnits(fundAmt, 6));
    await tx.wait();
  });

  await step(`fundAgent (${fundAmt} USDC → vault)`, async () => {
    const tx = await vault.fundAgent(getAddress(agentVault), parseUnits(fundAmt, 6));
    await tx.wait();
  });

  // 5. Build policy digest + sign + authorizePolicy
  const { createHash } = await import("node:crypto");
  const { solidityPackedKeccak256 } = await import("ethers");
  const policyObj = {
    product: "SpendOS",
    agentId: env("SPENDOS_AGENT", "research-agent"),
    network: "base",
    asset: "USDC",
    dailyLimit: Number(dailyLim),
    perTransactionLimit: Number(txLim),
    domains: (env("SPENDOS_DOMAINS", "api.tokensight.io,risk.baseintel.net")).split(",").map((s) => s.trim()).filter(Boolean),
    contracts: (env("SPENDOS_CONTRACTS", "")).split(",").map((s) => s.trim()).filter(Boolean),
    paused: false,
  };
  const policyDigest = `0x${createHash("sha256").update(JSON.stringify(policyObj)).digest("hex")}`;
  const dailyLimitUnits = parseUnits(dailyLim, 6);
  const txLimitUnits    = parseUnits(txLim, 6);
  const messageHash = solidityPackedKeccak256(
    ["string", "address", "uint256", "address", "address", "uint256", "uint256", "bytes32"],
    ["SpendOS Policy:", vaultAddr, BigInt(chainId), usdcAddr, getAddress(agentVault), dailyLimitUnits, txLimitUnits, policyDigest],
  );
  const signature = await wallet.signMessage(getBytes(messageHash));

  await step("Sign and submit authorizePolicy", async () => {
    const tx = await vault.authorizePolicy(
      getAddress(agentVault), dailyLimitUnits, txLimitUnits, policyDigest, signature
    );
    await tx.wait();
  });

  // 6. Update .env.local
  await step("Update .env.local", async () => {
    const envPath = join(ROOT, ".env.local");
    let content = existsSync(envPath) ? readFileSync(envPath, "utf8") : "";
    const set = (key, val) => {
      const re = new RegExp(`^${key}=.*$`, "m");
      if (re.test(content)) content = content.replace(re, `${key}=${val}`);
      else content += `\n${key}=${val}`;
    };
    set("SPENDOS_VAULT_ADDRESS", vaultAddr);
    set("USDC_ADDRESS", usdcAddr);
    set("SPENDOS_POLICY_DIGEST", policyDigest);
    set("SPENDOS_DEPLOYMENT_FILE", deploymentPath);
    writeFileSync(envPath, content, "utf8");
  });

  // 7. Final status check
  console.log("");
  console.log("  ── Vault Status ─────────────────────────────────────────────");
  const policy = await vault.policies(getAddress(agentVault));
  const balance = await usdc.balanceOf(getAddress(agentVault)).catch(() => null);
  console.log(`  Owner           : ${policy.owner}`);
  console.log(`  Available USDC  : ${formatUnits(policy.availableBalance, 6)}`);
  console.log(`  Daily limit     : ${formatUnits(policy.dailyLimit, 6)}`);
  console.log(`  Per-tx limit    : ${formatUnits(policy.perTransactionLimit, 6)}`);
  console.log(`  Paused          : ${policy.paused}`);
  console.log(`  Wallet balance  : ${balance !== null ? formatUnits(balance, 6) : "—"} USDC`);
  console.log(`  Policy digest   : ${policyDigest.slice(0, 18)}...`);
  console.log("");
  console.log("  ✓ Vault setup complete. Restart the proxy:");
  console.log("    ./start.sh");
  console.log("");
  console.log("  Basescan:");
  console.log(`    https://sepolia.basescan.org/address/${vaultAddr}`);
  console.log("");
}

main().catch((err) => {
  console.error(`\n  ✗ ERROR: ${err.message}\n`);
  process.exitCode = 1;
});
