#!/usr/bin/env node

import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  Contract,
  JsonRpcProvider,
  Wallet,
  formatUnits,
  getAddress,
  getBytes,
  parseUnits,
  solidityPackedKeccak256,
} from "ethers";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
const DEFAULT_DECIMALS = 6;
const BASE_USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  if (index === -1) return fallback;
  return process.argv[index + 1] || fallback;
}

function hasArg(name) {
  return process.argv.includes(name);
}

function actionName() {
  return process.argv[2] && !process.argv[2].startsWith("--") ? process.argv[2] : "status";
}

function required(value, name) {
  if (!value) throw new Error(`missing_${name}`);
  return value;
}

function rpcUrlFor(network = process.env.SPENDOS_DEPLOY_NETWORK || "base-sepolia") {
  if (process.env.RPC_URL) return process.env.RPC_URL;
  if (network === "base") return process.env.BASE_RPC_URL || "";
  return process.env.BASE_SEPOLIA_RPC_URL || "";
}

function readJson(path) {
  if (!existsSync(path)) throw new Error(`missing_file:${path}`);
  return JSON.parse(readFileSync(path, "utf8"));
}

function readArtifact(contractName) {
  return readJson(join("artifacts", `${contractName}.json`));
}

function latestDeployment(network = process.env.SPENDOS_DEPLOY_NETWORK || "base-sepolia") {
  const explicit = process.env.SPENDOS_DEPLOYMENT_FILE || argValue("--deployment", "");
  if (explicit) return readJson(explicit);

  const chainId = argValue("--chain-id", process.env.CHAIN_ID || "");
  const path = chainId ? join("deployments", `${network}-${chainId}.json`) : "";
  if (path && existsSync(path)) return readJson(path);

  return {};
}

function vaultAddress(config = latestDeployment()) {
  return getAddress(
    argValue("--vault", process.env.SPENDOS_VAULT_ADDRESS || config.vaultAddress || ZERO_ADDRESS),
  );
}

function usdcAddress(config = latestDeployment()) {
  return getAddress(argValue("--usdc", process.env.USDC_ADDRESS || config.usdcAddress || BASE_USDC));
}

function amountUnits(value, decimals = DEFAULT_DECIMALS) {
  return parseUnits(String(required(value, "amount")), decimals);
}

function policyDigestFromPolicy(policy) {
  return `0x${createHash("sha256").update(JSON.stringify(policy)).digest("hex")}`;
}

function policyDigestFromArgs() {
  const explicit = argValue("--policy-digest", process.env.SPENDOS_POLICY_DIGEST || "");
  if (explicit) return explicit;

  const policyPath = argValue("--policy-json", process.env.SPENDOS_POLICY_JSON || "");
  if (policyPath) return policyDigestFromPolicy(readJson(policyPath));

  const agentId = argValue("--agent-id", process.env.SPENDOS_AGENT || "research-agent");
  const dailyLimit = Number(argValue("--daily-limit", process.env.SPENDOS_DAILY_LIMIT || "10"));
  const perTransactionLimit = Number(
    argValue("--per-transaction-limit", process.env.SPENDOS_PER_TRANSACTION_LIMIT || "0.25"),
  );
  const domains = (argValue("--domains", process.env.SPENDOS_DOMAINS || "api.tokensight.io,risk.baseintel.net") || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  const contracts = (argValue("--contracts", process.env.SPENDOS_CONTRACTS || "0x8335...2913,0x4200...0006") || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  return policyDigestFromPolicy({
    product: "SpendOS",
    agentId,
    network: "base",
    asset: "USDC",
    dailyLimit,
    perTransactionLimit,
    domains,
    contracts,
    paused: false,
  });
}

function policyMessageHash({ vault, chainId, usdc, agentVault, dailyLimitUnits, perTransactionLimitUnits, policyDigest }) {
  return solidityPackedKeccak256(
    ["string", "address", "uint256", "address", "address", "uint256", "uint256", "bytes32"],
    [
      "SpendOS Policy:",
      getAddress(vault),
      BigInt(chainId),
      getAddress(usdc),
      getAddress(agentVault),
      BigInt(dailyLimitUnits),
      BigInt(perTransactionLimitUnits),
      policyDigest,
    ],
  );
}

function providerFor(network) {
  return new JsonRpcProvider(required(rpcUrlFor(network), "rpc_url"));
}

function walletFor(provider) {
  return new Wallet(required(process.env.PRIVATE_KEY || process.env.SPENDOS_OWNER_PRIVATE_KEY, "private_key"), provider);
}

function contractFor({ address, artifact, walletOrProvider }) {
  return new Contract(address, artifact.abi, walletOrProvider);
}

async function deploymentContext({ needsWallet = true } = {}) {
  const network = argValue("--network", process.env.SPENDOS_DEPLOY_NETWORK || "base-sepolia");
  const config = latestDeployment(network);
  const provider = providerFor(network);
  const wallet = needsWallet ? walletFor(provider) : null;
  const signerOrProvider = wallet || provider;
  const vaultArtifact = readArtifact("SpendOSVault");
  const usdcArtifact = readArtifact("MockUSDC");

  return {
    network,
    config,
    provider,
    wallet,
    vault: contractFor({ address: vaultAddress(config), artifact: vaultArtifact, walletOrProvider: signerOrProvider }),
    usdc: contractFor({ address: usdcAddress(config), artifact: usdcArtifact, walletOrProvider: signerOrProvider }),
    vaultAddress: vaultAddress(config),
    usdcAddress: usdcAddress(config),
  };
}

async function waitTx(tx) {
  const receipt = await tx.wait();
  return {
    txHash: tx.hash,
    blockNumber: receipt.blockNumber,
  };
}

async function statusCommand({ dryRun = false } = {}) {
  const agentVault = getAddress(required(argValue("--agent-vault", process.env.SPENDOS_AGENT_VAULT || ""), "agent_vault"));
  if (dryRun) {
    return {
      action: "status",
      vault: vaultAddress(),
      usdc: usdcAddress(),
      agentVault,
      ready: false,
    };
  }

  const context = await deploymentContext({ needsWallet: false });
  const policy = await context.vault.policies(agentVault);
  const usdcBalance = await context.usdc.balanceOf(agentVault).catch(() => null);
  return {
    action: "status",
    network: context.network,
    vault: context.vaultAddress,
    usdc: context.usdcAddress,
    agentVault,
    owner: policy.owner,
    availableBalance: formatUnits(policy.availableBalance, DEFAULT_DECIMALS),
    dailyLimit: formatUnits(policy.dailyLimit, DEFAULT_DECIMALS),
    perTransactionLimit: formatUnits(policy.perTransactionLimit, DEFAULT_DECIMALS),
    spentInWindow: formatUnits(policy.spentInWindow, DEFAULT_DECIMALS),
    paused: policy.paused,
    policyDigest: policy.policyDigest,
    walletUSDCBalance: usdcBalance === null ? null : formatUnits(usdcBalance, DEFAULT_DECIMALS),
  };
}

async function registerCommand({ dryRun = false } = {}) {
  const agentVault = getAddress(required(argValue("--agent-vault", process.env.SPENDOS_AGENT_VAULT || ""), "agent_vault"));
  if (dryRun) return { action: "register", vault: vaultAddress(), agentVault };

  const context = await deploymentContext();
  const tx = await context.vault.registerAgent(agentVault);
  return { action: "register", agentVault, ...(await waitTx(tx)) };
}

async function setOperatorCommand({ dryRun = false } = {}) {
  const operator = getAddress(required(argValue("--operator", process.env.SPENDOS_OPERATOR_ADDRESS || ""), "operator"));
  const allowed = argValue("--allowed", "true") !== "false";
  if (dryRun) return { action: "set-operator", vault: vaultAddress(), operator, allowed };

  const context = await deploymentContext();
  const tx = await context.vault.setOperator(operator, allowed);
  return { action: "set-operator", operator, allowed, ...(await waitTx(tx)) };
}

async function fundCommand({ dryRun = false } = {}) {
  const agentVault = getAddress(required(argValue("--agent-vault", process.env.SPENDOS_AGENT_VAULT || ""), "agent_vault"));
  const amount = amountUnits(argValue("--amount", process.env.SPENDOS_FUND_AMOUNT || ""));
  if (dryRun) {
    return {
      action: "fund",
      vault: vaultAddress(),
      usdc: usdcAddress(),
      agentVault,
      amount: formatUnits(amount, DEFAULT_DECIMALS),
    };
  }

  const context = await deploymentContext();
  const approve = await context.usdc.approve(context.vaultAddress, amount);
  const approveReceipt = await waitTx(approve);
  const fund = await context.vault.fundAgent(agentVault, amount);
  const fundReceipt = await waitTx(fund);
  return { action: "fund", agentVault, amount: formatUnits(amount, DEFAULT_DECIMALS), approve: approveReceipt, fund: fundReceipt };
}

async function mintMockCommand({ dryRun = false } = {}) {
  const to = getAddress(required(argValue("--to", process.env.SPENDOS_MINT_TO || ""), "to"));
  const amount = amountUnits(argValue("--amount", process.env.SPENDOS_MINT_AMOUNT || ""));
  if (dryRun) return { action: "mint-mock", usdc: usdcAddress(), to, amount: formatUnits(amount, DEFAULT_DECIMALS) };

  const context = await deploymentContext();
  const tx = await context.usdc.mint(to, amount);
  return { action: "mint-mock", to, amount: formatUnits(amount, DEFAULT_DECIMALS), ...(await waitTx(tx)) };
}

async function authorizePolicyCommand({ dryRun = false } = {}) {
  const agentVault = getAddress(required(argValue("--agent-vault", process.env.SPENDOS_AGENT_VAULT || ""), "agent_vault"));
  const dailyLimit = amountUnits(argValue("--daily-limit", process.env.SPENDOS_DAILY_LIMIT || "10"));
  const perTransactionLimit = amountUnits(
    argValue("--per-transaction-limit", process.env.SPENDOS_PER_TRANSACTION_LIMIT || "0.25"),
  );
  const policyDigest = policyDigestFromArgs();
  const network = argValue("--network", process.env.SPENDOS_DEPLOY_NETWORK || "base-sepolia");
  const config = latestDeployment(network);
  const currentVault = vaultAddress(config);
  const currentUsdc = usdcAddress(config);
  const chainId = Number(argValue("--chain-id", process.env.CHAIN_ID || config.chainId || "84532"));
  const messageHash = policyMessageHash({
    vault: currentVault,
    chainId,
    usdc: currentUsdc,
    agentVault,
    dailyLimitUnits: dailyLimit,
    perTransactionLimitUnits: perTransactionLimit,
    policyDigest,
  });

  const ownerPrivateKey = process.env.SPENDOS_OWNER_PRIVATE_KEY || process.env.PRIVATE_KEY || "";
  const signature = ownerPrivateKey ? await new Wallet(ownerPrivateKey).signMessage(getBytes(messageHash)) : null;
  const preview = {
    action: "authorize-policy",
    vault: currentVault,
    usdc: currentUsdc,
    agentVault,
    chainId,
    dailyLimit: formatUnits(dailyLimit, DEFAULT_DECIMALS),
    perTransactionLimit: formatUnits(perTransactionLimit, DEFAULT_DECIMALS),
    policyDigest,
    messageHash,
    signerConfigured: Boolean(ownerPrivateKey),
    signature,
  };
  if (dryRun) return preview;

  const context = await deploymentContext();
  const tx = await context.vault.authorizePolicy(agentVault, dailyLimit, perTransactionLimit, policyDigest, signature);
  return { ...preview, signature: `${signature.slice(0, 10)}...${signature.slice(-8)}`, ...(await waitTx(tx)) };
}

async function run(action = actionName(), { dryRun = hasArg("--dry-run") } = {}) {
  if (action === "status") return statusCommand({ dryRun });
  if (action === "register") return registerCommand({ dryRun });
  if (action === "set-operator") return setOperatorCommand({ dryRun });
  if (action === "fund") return fundCommand({ dryRun });
  if (action === "mint-mock") return mintMockCommand({ dryRun });
  if (action === "authorize-policy") return authorizePolicyCommand({ dryRun });
  throw new Error(`unknown_action:${action}`);
}

export {
  amountUnits,
  authorizePolicyCommand,
  policyDigestFromPolicy,
  policyMessageHash,
  run,
  statusCommand,
};

if (import.meta.url === `file://${process.argv[1]}`) {
  run()
    .then((result) => {
      console.log(JSON.stringify(result, null, 2));
    })
    .catch((error) => {
      console.error(error.message);
      process.exitCode = 1;
    });
}
