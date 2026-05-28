#!/usr/bin/env node

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ContractFactory, JsonRpcProvider, Wallet, getAddress } from "ethers";

const BASE_USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const ARTIFACTS_DIR = "artifacts";
const DEPLOYMENTS_DIR = "deployments";

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  if (index === -1) return fallback;
  return process.argv[index + 1] || fallback;
}

function hasArg(name) {
  return process.argv.includes(name);
}

function requiredEnv(keys) {
  for (const key of keys) {
    if (process.env[key]) return process.env[key];
  }

  throw new Error(`missing_env:${keys.join("|")}`);
}

function readArtifact(contractName) {
  const path = join(ARTIFACTS_DIR, `${contractName}.json`);
  if (!existsSync(path)) {
    throw new Error(`missing_artifact:${path}. Run npm run compile:contracts first.`);
  }

  return JSON.parse(readFileSync(path, "utf8"));
}

function networkName() {
  return argValue("--network", process.env.SPENDOS_DEPLOY_NETWORK || process.env.NETWORK || "base-sepolia");
}

function rpcUrlFor(network) {
  if (process.env.RPC_URL) return process.env.RPC_URL;
  if (network === "base") return requiredEnv(["BASE_RPC_URL"]);
  return requiredEnv(["BASE_SEPOLIA_RPC_URL"]);
}

function usdcAddressFor(network, deployMock) {
  if (deployMock) return "";
  if (process.env.USDC_ADDRESS) return getAddress(process.env.USDC_ADDRESS);
  if (network === "base") return BASE_USDC;
  throw new Error("missing_env:USDC_ADDRESS. Set USDC_ADDRESS or pass --mock-usdc for test deployments.");
}

async function deployContract({ artifact, wallet, args = [] }) {
  const factory = new ContractFactory(artifact.abi, artifact.bytecode, wallet);
  const contract = await factory.deploy(...args);
  const tx = contract.deploymentTransaction();
  const receipt = await tx.wait();

  return {
    contract,
    receipt,
    address: await contract.getAddress(),
    txHash: tx.hash,
  };
}

async function main() {
  const network = networkName();
  const deployMock = hasArg("--mock-usdc");
  const dryRun = hasArg("--dry-run");
  const rpcUrl = dryRun ? process.env.RPC_URL || process.env.BASE_RPC_URL || process.env.BASE_SEPOLIA_RPC_URL || "" : rpcUrlFor(network);
  const privateKey = dryRun ? process.env.PRIVATE_KEY || process.env.SPENDOS_DEPLOYER_PRIVATE_KEY || "" : requiredEnv(["PRIVATE_KEY", "SPENDOS_DEPLOYER_PRIVATE_KEY"]);
  const vaultArtifact = readArtifact("SpendOSVault");
  const mockArtifact = deployMock ? readArtifact("MockUSDC") : null;
  const staticUsdcAddress = dryRun && !deployMock ? process.env.USDC_ADDRESS || (network === "base" ? BASE_USDC : "") : usdcAddressFor(network, deployMock);

  if (dryRun) {
    console.log(
      JSON.stringify(
        {
          status: "dry_run",
          network,
          rpcConfigured: Boolean(rpcUrl),
          deployerConfigured: Boolean(privateKey),
          usdcAddress: deployMock ? "mock-usdc" : staticUsdcAddress || "not_configured",
          vaultArtifact: {
            abiItems: vaultArtifact.abi.length,
            bytecodeBytes: vaultArtifact.bytecode.length / 2 - 1,
          },
        },
        null,
        2,
      ),
    );
    return;
  }

  const provider = new JsonRpcProvider(rpcUrl);
  const wallet = new Wallet(privateKey, provider);
  const chain = await provider.getNetwork();
  const deployer = await wallet.getAddress();

  let usdcAddress = staticUsdcAddress;
  let mockDeployment = null;
  if (deployMock) {
    mockDeployment = await deployContract({ artifact: mockArtifact, wallet });
    usdcAddress = mockDeployment.address;
  }

  const vaultDeployment = await deployContract({
    artifact: vaultArtifact,
    wallet,
    args: [usdcAddress],
  });

  const deployment = {
    product: "SpendOS",
    network,
    chainId: Number(chain.chainId),
    deployer,
    usdcAddress,
    vaultAddress: vaultDeployment.address,
    vaultTxHash: vaultDeployment.txHash,
    vaultBlockNumber: vaultDeployment.receipt.blockNumber,
    deployedAt: new Date().toISOString(),
    artifacts: {
      SpendOSVault: join(ARTIFACTS_DIR, "SpendOSVault.json"),
      MockUSDC: deployMock ? join(ARTIFACTS_DIR, "MockUSDC.json") : null,
    },
    mockUSDC: mockDeployment
      ? {
          address: mockDeployment.address,
          txHash: mockDeployment.txHash,
          blockNumber: mockDeployment.receipt.blockNumber,
        }
      : null,
  };

  mkdirSync(DEPLOYMENTS_DIR, { recursive: true });
  const deploymentPath = join(DEPLOYMENTS_DIR, `${network}-${deployment.chainId}.json`);
  writeFileSync(deploymentPath, `${JSON.stringify(deployment, null, 2)}\n`);

  console.log(JSON.stringify({ status: "deployed", deploymentPath, ...deployment }, null, 2));
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
