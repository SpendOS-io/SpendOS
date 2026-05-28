#!/usr/bin/env node
/**
 * SpendOS x402 API Server
 * Gerçek ücretli API endpoint'leri simüle eder.
 * Ödeme gelmezse HTTP 402 döner, ödeme doğrulandıktan sonra veri verir.
 * Port: 4192
 */

import { createServer } from "node:http";
import { JsonRpcProvider, formatEther, getAddress } from "ethers";

const PORT = Number(process.env.X402_API_PORT || 4192);
const PROXY_URL = process.env.SPENDOS_PROXY_URL || "http://127.0.0.1:4191";
const PROXY_API_KEY = process.env.SPENDOS_API_KEYS?.split(",")[0] || "";
const RPC_URL = process.env.BASE_RPC_URL || "https://mainnet.base.org";
const DOMAIN = "x402-api.spendos.local";
const USDC_ADDRESS = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

const ENDPOINTS = {
  "/v1/token-price":     { price: 0.05, description: "Token price data (CoinGecko)",    domain: "api.tokensight.io" },
  "/v1/wallet-risk":     { price: 0.10, description: "Wallet risk analysis (on-chain)", domain: "risk.baseintel.net" },
  "/v1/calldata-decode": { price: 0.08, description: "Calldata ABI decoder",            domain: "decode.calldata.run" },
};

function respond(res, status, body) {
  const json = JSON.stringify(body, null, 2);
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, X-Payment",
  });
  res.end(json);
}

async function verifyReceipt(receiptId) {
  const headers = PROXY_API_KEY ? { "X-SpendOS-Key": PROXY_API_KEY } : {};
  const res = await fetch(`${PROXY_URL}/v1/receipts/${encodeURIComponent(receiptId)}`, {
    headers,
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) return null;
  const r = await res.json();
  return (r.status === "submitted" || r.status === "approved") ? r : null;
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  try { return JSON.parse(Buffer.concat(chunks).toString()); } catch { return {}; }
}

// ── Endpoint handlers ──────────────────────────────────────────────────────

async function tokenPrice(params) {
  let prices;
  try {
    const r = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=ethereum,usd-coin,wrapped-bitcoin&vs_currencies=usd&include_24hr_change=true",
      { signal: AbortSignal.timeout(6000) },
    );
    const d = await r.json();
    prices = {
      ETH:  { usd: d.ethereum?.usd,        change24h: d.ethereum?.usd_24h_change?.toFixed(2) },
      USDC: { usd: d["usd-coin"]?.usd,      change24h: d["usd-coin"]?.usd_24h_change?.toFixed(4) },
      WBTC: { usd: d["wrapped-bitcoin"]?.usd, change24h: d["wrapped-bitcoin"]?.usd_24h_change?.toFixed(2) },
    };
  } catch {
    prices = {
      ETH:  { usd: 3842.15, change24h: "+2.3",  note: "cached" },
      USDC: { usd: 1.0001,  change24h: "0.00",  note: "cached" },
      WBTC: { usd: 97420.5, change24h: "+1.8",  note: "cached" },
    };
  }
  return { prices, source: "coingecko", fetchedAt: new Date().toISOString() };
}

async function walletRisk(params) {
  const rawAddr = params.get("address") || "";
  let address, ethBalance = 0, txCount = 0, isContract = false;

  try {
    address = getAddress(rawAddr);
    const provider = new JsonRpcProvider(RPC_URL);
    const [bal, nonce, code] = await Promise.all([
      provider.getBalance(address),
      provider.getTransactionCount(address),
      provider.getCode(address),
    ]);
    ethBalance = Number(formatEther(bal));
    txCount = nonce;
    isContract = code !== "0x";
  } catch {
    address = rawAddr || "0x0000000000000000000000000000000000000000";
  }

  const score = isContract ? 5 : txCount === 0 ? 55 : txCount < 10 ? 35 : txCount < 100 ? 15 : 8;
  return {
    address,
    riskScore: score,
    riskLabel: score >= 50 ? "high" : score >= 25 ? "medium" : "low",
    signals: {
      ethBalance: ethBalance.toFixed(6),
      txCount,
      isContract,
      activity: txCount === 0 ? "new" : txCount < 10 ? "low" : txCount < 100 ? "moderate" : "high",
    },
    network: "base",
    analyzedAt: new Date().toISOString(),
  };
}

const KNOWN_SELECTORS = {
  "0xe79d5d2a": { name: "spendUSDC",    contract: "SpendOSVault", args: ["agentVault", "recipient", "amount", "service", "receiptHash"] },
  "0xa9059cbb": { name: "transfer",     contract: "ERC20",        args: ["to", "amount"] },
  "0x23b872dd": { name: "transferFrom", contract: "ERC20",        args: ["from", "to", "amount"] },
  "0x095ea7b3": { name: "approve",      contract: "ERC20",        args: ["spender", "amount"] },
  "0x70a08231": { name: "balanceOf",    contract: "ERC20",        args: ["account"] },
  "0x9a2ba2f8": { name: "authorizePolicy", contract: "SpendOSVault", args: ["agentVault", "dailyLimit", "perTransactionLimit", "policyDigest", "signature"] },
  "0xbedd3c07": { name: "fundAgent",    contract: "SpendOSVault", args: ["agentVault", "amount"] },
};

async function calldataDecode(params, body) {
  const calldata = body?.calldata || params.get("calldata") || "";
  const selector = calldata.slice(0, 10).toLowerCase();
  const match = KNOWN_SELECTORS[selector];
  return {
    calldata: calldata.slice(0, 66) + (calldata.length > 66 ? "..." : ""),
    selector,
    decoded: match || { name: "unknown", contract: "unknown", args: [] },
    known: Boolean(match),
    decodedAt: new Date().toISOString(),
  };
}

// ── HTTP server ────────────────────────────────────────────────────────────

const server = createServer(async (req, res) => {
  if (req.method === "OPTIONS") {
    res.writeHead(204, { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Content-Type, X-Payment" });
    res.end();
    return;
  }

  const url = new URL(req.url, `http://127.0.0.1:${PORT}`);
  const endpoint = ENDPOINTS[url.pathname];

  if (!endpoint) {
    respond(res, 404, { error: "not_found", available: Object.keys(ENDPOINTS) });
    return;
  }

  const paymentHeader = (req.headers["x-payment"] || "").trim();

  // No payment → HTTP 402 with requirements
  if (!paymentHeader) {
    respond(res, 402, {
      error: "payment_required",
      x402: {
        amount: endpoint.price,
        asset: "USDC",
        network: "base",
        description: endpoint.description,
        domain: endpoint.domain,
        contract: USDC_ADDRESS,
        paymentEndpoint: `${PROXY_URL}/v1/pay_x402`,
        submitEndpoint:  `${PROXY_URL}/v1/settlement/submit`,
        hint: "POST to paymentEndpoint → POST to submitEndpoint → retry with X-Payment: spendos:{receiptId}",
      },
    });
    return;
  }

  // Verify receipt
  const receiptId = paymentHeader.replace(/^spendos:/i, "").trim();
  let receipt;
  try {
    receipt = await verifyReceipt(receiptId);
  } catch {
    receipt = null;
  }

  if (!receipt) {
    respond(res, 402, { error: "payment_unverified", detail: "Receipt not found or not yet confirmed", receiptId });
    return;
  }

  const body = req.method === "POST" ? await readBody(req) : {};

  try {
    let data;
    if (url.pathname === "/v1/token-price")     data = await tokenPrice(url.searchParams);
    if (url.pathname === "/v1/wallet-risk")     data = await walletRisk(url.searchParams);
    if (url.pathname === "/v1/calldata-decode") data = await calldataDecode(url.searchParams, body);

    respond(res, 200, {
      status: "ok",
      endpoint: url.pathname,
      payment: { id: receipt.id, amount: receipt.amount, asset: receipt.asset },
      data,
    });
  } catch (err) {
    respond(res, 500, { error: "internal_error", detail: err.message });
  }
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`SpendOS x402 API server  →  http://127.0.0.1:${PORT}`);
  console.log(`  Endpoints: ${Object.entries(ENDPOINTS).map(([p, e]) => `${p} (${e.price} USDC)`).join(" | ")}`);
});
