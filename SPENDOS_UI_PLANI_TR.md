# SpendOS UI Planı

## Ürün Çerçevesi

SpendOS, Base üzerindeki otonom AI agent'lar için harcama kontrol katmanıdır.

AI agent'lara USDC bütçesi, harcama limitleri, x402/API ödeme kontrolleri, receipt kayıtları, onay mekanizması ve gerçek zamanlı risk uyarıları verir. Kullanıcı agent'a sınırsız cüzdan vermez; agent'a kontrollü bir SpendOS hesabı verir.

SpendOS kesinlikle GitBank klonu gibi görünmemeli. GitBank; GitHub içinde proje kasası, bounty ve PR ödeme otomasyonu. SpendOS ise agent payment infrastructure: wallet kontrolü, harcama policy'leri, x402 payment proxy, audit receipt ve autonomous agent güvenliği.

## Ana Konumlandırma

SpendOS

Autonomous agent'lar için harcama kontrolleri.

AI agent'larına Base üzerinde USDC bütçesi ver; limitler, onaylar, x402 ödemeleri, receipt'ler ve gerçek zamanlı risk kontrolleriyle harcamayı yönet.

## Ürün Konsepti

Kullanıcı bir AI agent için hesap oluşturur, Base USDC ile fonlar ve agent'ın nerelere para harcayabileceğini belirler.

Agent; paid API, x402 servisleri, market data, wallet risk scan, contract decode, research tool gibi ücretli autonomous action'lar için ödeme isteyebilir. SpendOS bu isteği policy'lere göre kontrol eder, ödemeyi imzalar veya engeller, receipt oluşturur ve tüm audit trail'i gösterir.

## İlk MVP

### Agent Wallet

- Her agent için kontrollü Base USDC wallet veya vault.
- Agent ödeme isteyebilir ama fonları serbestçe boşaltamaz.
- Owner access'i pause, revoke veya rotate edebilir.
- Wallet status, balance ve spend authority her zaman görünür.

### Spend Policies

- Günlük harcama limiti
- İşlem başına limit
- Domain allowlist
- Contract allowlist
- Kategori bazlı izinler
- Büyük ödemeler için approval threshold
- Bilinmeyen/riskli endpoint'ler için block rules

### x402 Payment Proxy

- Agent paid API veya x402 endpoint'e ödeme yapmak ister.
- SpendOS ödeme öncesi policy kontrolü yapar.
- Onaylanırsa ödeme imzalanır / execute edilir.
- Engellenirse structured denial reason döner.
- Her ödeme receipt üretir.

### Dashboard

Dashboard şu soruları cevaplar:

- Hangi agent para harcadı?
- Hangi servise ödeme yaptı?
- Hangi task veya prompt bu ödemeyi tetikledi?
- Kaç USDC harcandı?
- Payment approved, blocked veya pending mi?
- Tx hash ne?
- Hangi receipt üretildi?

### Risk Alerts

- Bilinmeyen endpoint
- Suspicious domain
- Normal aralığa göre yüksek fiyat
- Tekrarlanan ödeme denemesi
- Allowlist'te olmayan contract
- Olası metadata leak
- Endpoint response behavior değişimi

### MCP / SDK

SpendOS; Claude, Codex, Cursor ve custom agent'lar için tool sunmalı.

Tool isimleri:

- `request_budget`
- `pay_x402`
- `check_policy`
- `get_receipts`
- `pause_agent`

## En Güçlü Demo Senaryosu

Kullanıcı research agent'a görev verir:

"Analyze this wallet."

Agent üç paid API çağırmak ister:

- Token price API
- Wallet risk API
- Contract decode API

SpendOS iki ödemeyi onaylar, bir riskli endpoint'i engeller, toplam 0.42 USDC harcatır ve final activity report üretir:

"Agent spent 0.42 USDC across 2 approved tools. 1 payment blocked. Receipts attached."

Bu demo ürün değerini net gösterir: agent para harcayabilir ama sadece kontrollü policy sınırları içinde.

## Görsel Yön

SpendOS, premium bir autonomous finance control interface gibi tasarlanmalı.

UI, Base network üzerindeki AI agent harcamaları için classified operational control room gibi hissettirmeli.

Şunlar gibi olmamalı:

- Startup SaaS dashboard
- Chatbot
- Crypto trading UI
- Web3 neon branding

Ürünün hissi:

"Autonomous intelligence için finansal altyapı."

Görsel yön:

- Mat near-black yüzeyler
- Bone white tipografi
- Muted pale green accent'ler
- İnce, düşük kontrastlı geometrik borderlar
- Sıkıştırılmış bilgi yoğunluğu
- Terminal telemetry estetiği
- Military research terminal havası
- Operational intelligence dashboard
- Autonomous systems control center
- Subtle radar/scanning görselleri
- Receipt, audit ve security görsel dili
- Yoğun ama zarif layout
- Neredeyse hiç glow yok
- Neredeyse hiç blur yok
- Gradient yok
- Glassmorphism yok
- Floating card yok
- Renkli startup paleti yok

Arayüz ilhamları:

- Bloomberg Terminal
- Palantir Foundry
- Eski CRT sistemleri
- Military command software
- Spekülatif research terminal'ları
- Intelligence operations center

Ana duygu:

- Kaçınılmaz
- Classified
- Operasyonel
- Kontrollü
- Stratejik
- Kriptik
- Machine-governed
- Security-first
- Autonomous financial enforcement

## Marka

- İsim: SpendOS
- Alt başlık: Spending controls for autonomous agents
- Logo: verilen radar/glyph görseli kullanılacak: `/Users/frank/Desktop/emergent.jpeg`
- Görsel imza: siyah üstünde beyaz / soluk yeşil radar sembolü
- Ton: kontrollü, zeki, operasyonel, hafif kriptik

## İlk Ekran

İlk ekran landing page olmayacak. Kullanıcı direkt çalışan ürün arayüzünü görecek.

Full-screen app arayüzü:

- Üst navigasyon
- Sol Agent Control paneli
- Orta ana operasyon yüzeyi
- Sağ Agent File paneli

## Layout

Desktop: üç kolon.

1. Sol: Agent Control paneli
2. Orta: ana operasyon yüzeyi
3. Sağ: Agent File paneli

Mobil: aynı sırayla alt alta.

Panel kuralları:

- İnce borderlı sade paneller
- Keskin dikdörtgen kontroller
- Çok küçük radius veya hiç radius yok
- Kart içinde kart yok
- Floating marketing section yok
- Kompakt, yoğun, okunabilir bilgi mimarisi

## Üst Navigasyon

İçerik:

- Symbolic glyph logo
- SpendOS ürün adı
- Alt başlık: Spending controls for autonomous agents
- Mode switch: Monitor / Simulate / Enforce
- Copy/export action

## Sol Panel

Başlık: Agent Control

Kontroller:

- Agent selector
- Agent wallet balance
- USDC budget input
- Daily limit control
- Per-transaction limit control
- Domain allowlist
- Contract allowlist
- x402 category permissions
- Pause Agent button
- Terminal activity log

Örnek log metinleri:

- `POLICY: daily limit set to 10.00 USDC`
- `REQUEST: research-agent wants to pay 0.18 USDC`
- `CHECK: domain allowlist matched`
- `DENY: endpoint risk score above threshold`
- `RECEIPT: payment recorded on Base`

## Orta Alan

Ana operasyon yüzeyi burası.

İçerik:

- Animasyonlu radar/scanning canvas arka planı
- Agent identity glyph
- Current spend state
- Live payment request queue
- Policy decision feed
- Tablar: Activity, Policies, x402, Risk, Receipts, Simulation
- Approved payments
- Blocked requests
- Autonomous policy enforcement
- Receipt generation feed

Bu alan real-time autonomous financial operations gibi hissettirmeli. Conversation UI gibi olmamalı.

## Sağ Panel

Başlık: Agent File

Alanlar:

- Agent name
- Network: Base
- Asset: USDC
- Wallet/vault address
- Daily limit
- Risk mode
- Spend authority
- Risk Score
- One-line memo

Aksiyonlar:

- Save Policy
- Export Receipts
- Export Policy JSON
- Pause Agent

Library:

- Saved agents
- Recent receipts
- Blocked payments
- Policy templates

## His

SpendOS şunları ima etmeli:

- Finansal kontrol altında autonomous intelligence
- Enforceable boundary'lere sahip agent wallet'lar
- Weak-signal risk detection
- Gerçek zamanlı policy kararları
- Receipt ve auditability
- Agent money movement için classified control room arayüzü

Kullanıcı şunu hissetmeli:

"Autonomous financial enforcement infrastructure işletiyorum."

Şunu hissetmemeli:

"Bir AI SaaS app kullanıyorum."

## Tipografi

- Modern grotesk sans-serif
- Uppercase metadata label'lar
- Monospace telemetry log'ları
- Tight spacing
- Compact operational hierarchy
- Aktif agent/system state dışında marketing hero gibi büyük başlık yok

## Renk Sistemi

- Arka plan: `#000000`
- İkincil arka plan: `#0B0F0C`
- Ana metin: bone white
- İkincil metin: muted gray
- Accent: muted pale green
- Warning: restrained amber
- Danger: restrained red
- Border: düşük kontrastlı gri/yeşil

## Kaçınılacaklar

- Primary UX olarak GitHub bounty workflow
- PR merge payout flow
- Repo treasury dili
- Token launchpad dili
- Gradient arka plan
- Neon cyberpunk
- Web3 coin estetiği
- Glowing purple
- Yuvarlak/bubbly SaaS kartları
- Hero marketing section
- İllüstrasyon
- Maskot
- Floating UI
- Generic analytics dashboard
- Chatbot window
- Card-inside-card layout
