#!/usr/bin/env node

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join, relative } from "node:path";
import solc from "solc";

const CONTRACTS_DIR = "contracts";
const ARTIFACTS_DIR = "artifacts";
const TARGETS = ["SpendOSVault", "MockUSDC"];

function soliditySources(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return soliditySources(path);
    if (!entry.name.endsWith(".sol")) return [];

    const sourceName = relative(process.cwd(), path);
    return [
      [
        sourceName,
        {
          content: readFileSync(path, "utf8"),
        },
      ],
    ];
  });
}

function buildInput() {
  return {
    language: "Solidity",
    sources: Object.fromEntries(soliditySources(CONTRACTS_DIR)),
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
      outputSelection: {
        "*": {
          "*": ["abi", "evm.bytecode.object", "evm.deployedBytecode.object", "metadata"],
        },
      },
    },
  };
}

function findContract(output, contractName) {
  for (const [sourceName, contracts] of Object.entries(output.contracts || {})) {
    if (contracts[contractName]) {
      return {
        sourceName,
        contractName,
        artifact: contracts[contractName],
      };
    }
  }

  throw new Error(`contract_not_found:${contractName}`);
}

function writeArtifact({ sourceName, contractName, artifact }) {
  const bytecode = artifact.evm?.bytecode?.object || "";
  const deployedBytecode = artifact.evm?.deployedBytecode?.object || "";
  if (!bytecode) {
    throw new Error(`empty_bytecode:${contractName}`);
  }

  mkdirSync(ARTIFACTS_DIR, { recursive: true });
  const payload = {
    contractName,
    sourceName,
    compiler: {
      name: "solc-js",
      version: solc.version(),
    },
    abi: artifact.abi,
    bytecode: `0x${bytecode}`,
    deployedBytecode: `0x${deployedBytecode}`,
    metadata: JSON.parse(artifact.metadata),
  };

  const path = join(ARTIFACTS_DIR, `${contractName}.json`);
  writeFileSync(path, `${JSON.stringify(payload, null, 2)}\n`);
  return {
    contractName,
    path,
    abiItems: payload.abi.length,
    bytecodeBytes: bytecode.length / 2,
  };
}

function main() {
  if (!existsSync(CONTRACTS_DIR)) {
    throw new Error(`missing_contracts_dir:${CONTRACTS_DIR}`);
  }

  const input = buildInput();
  const output = JSON.parse(solc.compile(JSON.stringify(input)));
  const errors = (output.errors || []).filter((item) => item.severity === "error");
  const warnings = (output.errors || []).filter((item) => item.severity !== "error");

  warnings.forEach((warning) => {
    console.warn(warning.formattedMessage.trim());
  });

  if (errors.length) {
    errors.forEach((error) => console.error(error.formattedMessage.trim()));
    throw new Error("solidity_compile_failed");
  }

  const artifacts = TARGETS.map((contractName) => writeArtifact(findContract(output, contractName)));

  console.log(
    JSON.stringify(
      {
        status: "compiled",
        compiler: solc.version(),
        sources: Object.keys(input.sources).map((source) => basename(source)),
        artifacts,
      },
      null,
      2,
    ),
  );
}

main();
