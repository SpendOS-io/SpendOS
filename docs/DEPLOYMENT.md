# SpendOS — Base Sepolia Deploy Rehberi

## 1. Ön Hazırlık

### Testnet cüzdanı kur
- MetaMask'ta yeni bir cüzdan oluştur (SADECE testnet için)
- Private key'i kopyala
- Base Sepolia ETH al: https://www.coinbase.com/faucets/base-ethereum-sepolia-faucet

### Base Sepolia USDC al
- https://faucet.circle.com → "Base Sepolia" seç → cüzdan adresine USDC gönder
- 10 USDC yeterli

---

## 2. .env.local Doldur

```
cd ~/Documents/Codex/2026-05-25/base-a-nda-ai-agent-trendi
```

`.env.local` dosyasında şunları doldur:

```bash
PRIVATE_KEY=0x<testnet-private-key>
SPENDOS_DEPLOYER_PRIVATE_KEY=0x<testnet-private-key>
SPENDOS_OPERATOR_PRIVATE_KEY=0x<operator-private-key>   # aynı ya da farklı cüzdan olabilir
BASE_SEPOLIA_RPC_URL=https://sepolia.base.org
```

---

## 3. Dry-run (risk yok, sadece kontrol)

```bash
node scripts/deploy-spendos-vault.mjs --dry-run
```

Çıktı şöyle görünmeli:
```json
{
  "status": "dry_run",
  "network": "base-sepolia",
  "rpcConfigured": true,
  "deployerConfigured": true,
  ...
}
```

---

## 4. Deploy

```bash
# Base Sepolia'ya deploy et (MockUSDC ile — Circle faucet USDC yoksa)
node scripts/deploy-spendos-vault.mjs --network base-sepolia --mock-usdc

# YA DA Circle faucet USDC kullan (USDC_ADDRESS env'de olmalı)
USDC_ADDRESS=0x036CbD53842c5426634e7929541eC2318f3dCF7e \
  node scripts/deploy-spendos-vault.mjs --network base-sepolia
```

> Circle'ın Base Sepolia USDC adresi: `0x036CbD53842c5426634e7929541eC2318f3dCF7e`

---

## 5. .env.local'ı Deploy Çıktısıyla Güncelle

Deploy tamamlandığında terminal şöyle bir çıktı verir:

```json
{
  "status": "deployed",
  "network": "base-sepolia",
  "vaultAddress": "0x...",
  "txHash": "0x..."
}
```

Bu değerleri `.env.local`'a ekle:

```bash
SPENDOS_VAULT_ADDRESS=0x<vaultAddress>
USDC_ADDRESS=0x036CbD53842c5426634e7929541eC2318f3dCF7e
```

---

## 6. Agent Vault'u Kayıt Et ve Finanse Et

```bash
# Agent vault adresini ayarla (.env.local'da)
SPENDOS_AGENT_VAULT=0x<agent-wallet-address>

# Vault'a kaydol
node scripts/vault-admin.mjs status

# Policy authorize et
node scripts/vault-admin.mjs authorize-policy

# USDC gönder (10 USDC)
node scripts/vault-admin.mjs fund --amount 10
```

---

## 7. Proxy'yi Live Moduyla Başlat

```bash
./start.sh
```

Proxy artık `.env.local`'daki vault adresine gerçek onchain işlemler yapabilir.

---

## 8. Frontend'den Live Vault Kontrolü

1. Tarayıcıda `http://127.0.0.1:4180` aç
2. **Launch App** → **Vault** tab'ına git
3. **Run Launch Check** butonuna bas
4. 7/7 check geçerse sistem canlı

---

## Basescan Takip

- https://sepolia.basescan.org/address/<SPENDOS_VAULT_ADDRESS>

---

## Mainnet'e Geçiş (Gelecek)

Mainnet deploy için:
```bash
PRIVATE_KEY=0x<mainnet-key> \
USDC_ADDRESS=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 \
  node scripts/deploy-spendos-vault.mjs --network base
```

⚠️ Mainnet'te gerçek fon harcanır. Önce Sepolia'da tam test yap.
