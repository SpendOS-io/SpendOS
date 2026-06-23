// SpendOS — production config (safe defaults, no secrets)
// Local override: config.local.js (gitignored) is loaded after this file
// and overwrites these values with real proxy URL and API key.
window.SPENDOS_CONFIG = {
  apiKey: "",
  proxyUrl: "",
  x402ApiUrl: "",
  agentVault: "",
  vaultContract: "0xC3C474a7917eCFDE5A25B64A58a190f901F9241A",
  network: "base",
  chainId: 8453,
};
