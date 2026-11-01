# iHaveTools — Pura Plan (Complete Roadmap)

> **Goal:** Google par rank karne wali, lightning-fast, best-quality free tools site.
> **Updated:** 2026-11-01 · **Live:** https://i-have-tools.vercel.app (Vercel,
> `main` par merge = auto-deploy) · **Tools:** 98 (Batch-1: 94, Batch-2: 98)
>
> **🧭 KAAM KARNE KA RULE (2026-11-01 se):** Chhote-chhote changes ke liye
> baar-baar branch nahi banega. **Pehle ye pura plan, phir ek branch = ek
> BADA batch = ek PR.** Har batch ke end par: `npm run check` full green →
> PR → CI + Vercel preview pass → merge → production verify → PLAN tick.

---

## ✅ Jo ho chuka hai (history, short me)

**Base + Speed/SEO foundation (PR #1–#2):** service-worker fix (`/sw.js`),
slim lazy search index (71 KB registry har page se hata), external SVG sprite,
static crawlable header/nav (no CLS), modulepreload, speculation rules,
honest sitemap `lastmod`, rich schema (`WebApplication`/`HowTo`/`FAQPage`/
breadcrumbs), About/Privacy/Terms pages, `llms.txt`, CTR-style meta
descriptions, reproducible build (`ROOT_PREFIX='/'` lock).

**Naye tools (80 → 91):** SIP, PPF, FD, Image to PDF, Income Tax (FY 2025-26,
old-vs-new), JPG↔PNG/WebP landing pages (4), YouTube Thumbnail Downloader,
QR Code Generator (vendored MIT encoder, jsQR se decode-verify karke).

**UX/SEO extras:** per-category OG images (16), header search + Ctrl/⌘K,
⭐ Favourites + Recently Used (localStorage), Copy-Link share button,
12 top tools par hand-written **deep guides** (engine-verified numbers).

**⚠️ Zaroori corrections jo ho chuki:**
- `ihavetools.web.app` (Firebase) kabhi deploy hua hi nahi tha ("Site Not
  Found") — canonical primary ab `https://i-have-tools.vercel.app` hai
  (registry.js → `site.url`). Domain mile to yahi ek line badlegi.
- Repo **PUBLIC** hai → GitHub Actions free chalta hai (billing tension khatm).
- Vercel `outputDirectory="."` hi sahi hai (`STATIC_BUILD_NO_OUT_DIR` fix).

**Search engines (2026-10-31 ✅):** Google Search Console property verified
(meta tag site me), `sitemap.xml` submit, Bing Webmaster import done.
Indexing 1–4 hafte me gradually hoti hai; shuruaat me "Discovered –
currently not indexed" **normal** hai. Har hafte GSC → Pages report check.

**Quality bar (non-negotiable):** no placeholders/adhure tools; jo number
guide/FAQ me likha hai wo pehle engine se calculate karke verify hota hai;
test suite last check par **235/235 green** (engine+DOM+Chrome+link).

---

## 🔨 BATCH-1 — "Finance + Sharing" (✅ DONE — 2026-11-01)

Ek hi PR me ye sab:

1. **Ye pura plan document** (roadmap fix, taaki aage sochna na pade). ✅
2. **Shareable result links — SAARE calculators par** ✅
   har calculator apni values URL me likhta hai (`?monthly=5000&rate=12&years=10`)
   aur aisa link khulte hi values pre-filled + result ready milta hai.
   Copy-Link button ab result bhi saath le jata hai. (`ui.js` → `shareState()`)
   Tools: Percentage, Percentage Change, Discount, Age, BMI, GST, EMI, Tip,
   Compound Interest, Simple Interest, SIP, PPF, FD, Income Tax, RD, CAGR,
   Gratuity — kul 17.
3. **3 naye high-search finance tools** (pure tested logic ke saath): ✅
   - **RD Calculator** — monthly deposit, quarterly compounding
     (standard closed-form: A = P×[((1+i)ⁿ−1)/(1−(1+i)^(−1/3))], i=R/400).
   - **CAGR Calculator** — (End÷Start)^(1/years) − 1.
   - **Gratuity Calculator** — (15/26) × (basic+DA) × service years
     (Payment of Gratuity Act wala formula, 6-maheene-se-upar = pura saal).
4. **Deep guides — Batch-2:** GST, Compound Interest, Simple Interest,
   Discount, FD, PPF + teeno naye tools (RD/CAGR/Gratuity). ✅
   (Total guides ab 21 tools par; saare worked examples engine-verified.)
5. **Tests:** teeno naye calculators ke engine tests (haath se verify kiye
   numbers), share-link pre-fill/auto-run/URL-sync ka DOM test,
   guide-structure test 21 tools tak. Suite: **238/238 green.** ✅
6. **Housekeeping:** OG images regenerate (calculators 14→17, saath me
   image/web-seo ke QR-se-badle counts bhi fresh), README 91 → 94. ✅

**Batch-1 ki definition of done:** upar ke 6 point complete, `npm run check`
full green, generated pages committed, PR merged, Vercel production par
naye pages + ek shareable link live-verify.

---

## ✅ BATCH-2 — "Content depth + naye tools" — DONE (2026-11-01)

Ek hi branch/PR me shipped (tools 94 → **98**, guides 21 → **33**):

1. **4 naye tools:** Number Base Converter (BigInt-exact binary/octal/
   decimal/hex), Roman Numeral Converter (strict 1–3999 rules), Morse
   Code Translator (sound playback ke saath), Lumpsum Calculator
   (shareable links + Lumpsum-vs-SIP comparison guide). ✅
2. **Guides Batch-3 (8):** UUID, Base64, JPG→PNG, PNG→JPG, PDF Merge,
   YouTube Thumbnail, Character Counter, Timestamp — har fact engine
   se verify karke (Base64 3-byte table, UUID collision math, YT size
   table, SMS 160→70 rule, 2038 overflow...). Char Counter + Timestamp
   ko pehli baar custom FAQs bhi mile. ✅
3. **Per-tool OG images:** top-20 popularity tools ko apni khud ki
   1200×630 OG image (`scripts/og.mjs` generate karta hai;
   `build.mjs` exist kare to use karta hai, warna category OG).
   Test suite me iski guarantee added. ✅
4. **Tests:** base/roman/morse engine test + 4 naye tools ka DOM
   mount-compute test + top-20 OG link assertions. Suite **240/240**. ✅
5. **GSC CTR tuning — Batch-3 me deferred:** abhi real query data
   available nahi (site nayi hai); guesswork se titles nahi badlenge.
   Tum GSC me Performance → Queries ka screenshot/data jab aaye to
   share karna, Batch-3 usi par banega.

## 📋 BATCH-3 — "Data-driven growth" (agli branch, Continue par)

- **GSC CTR tuning:** indexed pages ke real queries par title/description
  tuning (jo Batch-2 se yahan shift hua — data aane par). Jo queries
  page-2 par atki hain un pages ka content aur deep; "indexed nahi
  hue" pages ki wajah fix.
- Full performance + accessibility audit pass (Lighthouse sab templates par).
- PWA install prompt ("Add to home screen") — SW pehle se ready hai.
- Agar tab tak revenue/budget aaya → **custom domain** (neeche dekho).

---

## 🧑 Sirf tum kar sakte ho (off-code, ₹0 wale pehle)

1. **GSC hafte me 1 baar** (2 min): Pages report — indexed count badh raha
   hai ya nahi. Kuch ajeeb dikhe → mujhe batao, mai fix karunga.
2. **Backlinks/launch (sabse bada ranking lever code ke bahar):**
   Product Hunt launch, Reddit par genuine posts (spam nahi), ek dev.to/
   Hashnode article ("tools jo bina upload ke browser me chalte hain"),
   tool directories (AlternativeTo, SaaSHub), GitHub awesome-lists me PR,
   aur seedha-saada doston/WhatsApp par share. Jitna genuine, utna achha.
3. **Analytics (free):** GoatCounter/Plausible jaisa privacy-friendly free
   option — taaki pata chale kaunse tools asal me use ho rahe hain. Lagane
   se pehle mujhe bolo, Privacy Policy mai saath update kar dunga.
4. **Custom domain — JAB budget ho (abhi bilkul pressure nahi):**
   `ihavetools.com` jaisa domain (~₹800–1,500/saal class ka kharcha) Vercel
   par connect → mai `site.url` badal kar rebuild kar dunga (15 min ka kaam).
   Tab tak Vercel subdomain hi primary hai — koi sketchy free TLD nahi lenge.

## 💰 Monetization (traffic aane ke baad hi)

- AdSense (About/Privacy/Terms ready hain) — ads tool-panel ke **bahar**,
  speed/UX kharab ki to ranking giregi.
- Browser extension (search palette) — power users ke liye.

---

## Honest ranking sach

Technical SEO + achhe tools zaroori hain lekin akele kaafi nahi: nayi site
ko rank hone me aam taur par **2–6 mahine** lagte hain. Tez karne wali
cheezein, order me: (1) indexing complete hona, (2) backlinks/launch,
(3) lagataar naye tools + deep content, (4) custom domain (jab ho sake).
Plan isi order me bana hai — code wala hissa mai sambhal raha hu,
bahar wala tumhare haath me hai. 🤝
