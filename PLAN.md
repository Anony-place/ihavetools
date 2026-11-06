# iHaveTools — Pura Plan (Complete Roadmap)

> **Goal:** Google par rank karne wali, lightning-fast, best-quality free tools site.
> **Updated:** 2026-11-01 · **Live:** https://i-have-tools.vercel.app (Vercel,
> `main` par merge = auto-deploy) · **Tools:** 122 (62 guides)
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

## ✅ BATCH-3 — "GSC striking-distance upgrades" (IMPLEMENTED — 2026-11-03; GSC measurement pending)

Pehla 7-day GSC baseline mil gaya hai. Sample abhi chhota hai (27 queries,
sabse bade page par 29 impressions, 0 clicks), isliye koi bada title
experiment guesswork se nahi hoga. Data ka saaf signal **CTR nahi,
position** hai:

| Page / query | Impressions | Avg. position | Decision |
|---|---:|---:|---|
| Percentage Change | 3 | **8.3** | Sabse pehle strengthen karo — name me “Calculator”, formula display, guide/FAQs |
| Query: `keyword frequency counter` | 2 | **24.5** | Keyword page ko real frequency-counter banao: target phrase count, distinct terms, CSV, guide |
| Palette Generator | 3 | 25.3 | CSS export/copy-all jaisi utility + guide |
| Data Storage Converter | 6 | 38.8 | Decimal-vs-binary guide/FAQs + converter-cluster internal links |
| Robots.txt Generator | 29 | 89.1 | Title pehle se exact-match hai; sirf meta badalna bekaar — URL tester, useful presets aur deep guide se product differentiate karo |
| QR Code Generator | 4 | 81.3 | Guide pehle se strong hai; abhi monitor, blind change nahi |

Is ek branch/PR me shipped:

1. Upar ke 5 pages par product/content upgrades (Percentage Change,
   Keyword Frequency/Density, Data Storage, Palette, Robots.txt). ✅
2. Related-tool ranking ab same engine/topical cluster ko popularity se
   pehle rakhta hai, plus Web-SEO cluster ke manual contextual links.
   Keyword related inbound 1 → 6 aur Data Storage 0 → 8 ho gaya. ✅
3. Deep guides 33 → **38 tools**; naye pure functions ke engine tests,
   paanch upgraded UIs ka DOM test aur guide/related-link assertions.
   Full suite **244/244 green** (164 engine + 52 DOM + 8 Chrome + 20 link). ✅
4. **Measurement rule:** deploy ke baad kam se kam 14 din ka GSC trend
   compare hoga. Impressions badhna hi success nahi; target average
   position ka 50+ zone se 11–30 zone ki taraf aana aur phir clicks hai.

**Abhi bhi pending user-side evidence:** `Indexing → Pages` ka screenshot
nahi mila, isliye total indexed/not-indexed count aur reasons par koi
claim/fix is batch me nahi. Wo report milte hi alag diagnosis hoga.

## ✅ BATCH-4 — "In-demand market coverage" (IMPLEMENTED — 2026-11-03)

GSC ka 14-day measurement chalega, lekin development wait nahi karega.
Batch-4 ka selection teen filters se hua hai: (1) India/global me clear
repeat-use demand, (2) browser-local bina backend/API ke best-quality
implementation possible, (3) existing clusters ko strong internal links
milte hain. Thin/duplicate landing pages sirf count badhane ke liye nahi
banegi.

Ek hi branch/PR me 8 naye tools (98 → **106**):

1. **NPS Calculator** — retirement corpus, annuity portion aur estimated
   monthly pension, step-up contribution ke saath.
2. **EPF Calculator** — employee/employer EPF contributions (EPS cap ko
   alag dikhakar), salary growth aur year-wise balance.
3. **HRA Calculator** — Section 10(13A) ki teen limits me sabse kam wali
   exemption, taxable HRA aur winning condition transparent.
4. **CGPA Calculator** — CGPA ↔ percentage (institution multiplier ke
   saath) aur credit-weighted SGPA subjects se.
5. **Attendance Calculator** — current %, target tak kitni classes
   lagatar attend karni hain, ya kitni safely miss ho sakti hain.
6. **QR Code Scanner** — image upload + live camera decode, safe payload
   actions (URL/Wi-Fi/email/phone), QR Generator cluster complete.
7. **Spin the Wheel — Random Name Picker** — crypto-random winner, wheel
   animation, shuffle, winner history aur remove-winner flow.
8. **Typing Speed Test** — 30/60/120-second tests, net/gross WPM,
   accuracy, CPM aur per-character live feedback.

Har tool ke saath: pure-logic engine tests, DOM interaction test,
hand-written deep guide + FAQs (guides 38 → **46**), shareable links
jaha inputs share karna safe/useful hai, generated pages, full
`npm run check`, ek PR, production merge/deploy verify.

**Batch-4 implementation status (2026-11-03):** teino clusters ship-ready
hain — **106 tools / 46 deep guides**, full suite **252/252 green**
(169 engine + 55 DOM + 8 Chrome + 20 link). QR Scanner ke liye Apache-2.0
jsQR isi site se lazy-load hota hai (koi external scan server nahi), aur
top-20 OG set me 6 naye Batch-4 pages ki per-tool images bhi generated
hain. Batch-3 ka GSC measurement isse alag apne 14-day clock par chalega.

**Batch-5 me shifted:** Full Lighthouse/accessibility pass aur PWA install
prompt. Abhi pehle discoverable demand coverage badhana hai; performance
foundation pehle se strong hai.

---

## BATCH-5 — Market-led retention, PWA & accessibility (2026-11-05)

Market review: competing utility suites prominently surface PDF/image workflows,
calculators and privacy-first local processing. Our existing catalogue already
covers the core merge/split, image compression and calculators; demand evidence
is qualitative, not search-volume or ranking proof. Avoid duplicate thin tools.
Prioritise repeat-use experience and correctness before adding speculative pages.

One batch on this branch:
1. Audit offline caching: home should be available after installation; visited
   pages/assets should work offline, unvisited pages get an honest offline page;
   query parameters must not multiply cached HTML or leak shared input values.
   Preserve other apps' caches and limit runtime storage; update assets safely.
2. Add a non-intrusive, accessible install action only when the browser offers
   native installation; no fake prompts or unsupported-browser promises.
3. Run performance/accessibility audit where browser tooling is available, fix
   actionable issues and document actual measurements or tooling limitations.
4. Add regression coverage for worker lifecycle, offline/error/cache behavior,
   and install UI; run full check. Rebuild generated pages, review, then one PR
   and production verification if checks and deployment permit.
5. GSC remains separate: compare at least 14 days and inspect Indexing → Pages
   when user supplies it; do not claim ranking improvements without data.

Implementation: native install button only when offered; versioned service worker
pre-caches home and offline notice, network-first cached visited pages/assets,
query strings excluded from page cache, capped runtime caches and cleanup limited
to iHaveTools caches. Offline functionality requires previously cached resources.
Automated `npm run check`: 169 engine, 55 DOM, 9 chrome, worker regression suite,
20 integrity checks passed. Sample static HTML axe-core/jsdom audit of home, NPS
and QR scanner: zero reported violations after removing invalid search input
`aria-expanded`; colour contrast disabled and two checks incomplete in jsdom.
No Lighthouse score or real-browser/device accessibility or install/offline test
is claimed: Chromium is not available in this environment. A full Lighthouse,
keyboard/screen-reader and real-device offline pass remains open.

---

## ✅ BATCH-6 — Student, investment and everyday planning (2026-11-05)

Market review (qualitative, not search-volume evidence): Calcmint and
MasterCalculator highlight final-grade and everyday cost calculators; Calkulator
lists SWP and goal planners. These are distinct tasks missing from our existing
106-tool catalogue, not duplicate SEO pages.

One planned batch on the active branch:
1. Final Grade Calculator: required final score, feasibility and score scenarios,
   including 0% and 100% exam weights and school-specific grading caveats.
2. Savings Goal Calculator: monthly end-of-month contribution for a target,
   initial balance, editable return, zero-rate and already-funded cases.
3. SWP Calculator: month-by-month withdrawal projection, partial final withdrawal,
   depletion and honest assumptions; no guaranteed return/tax claims.
4. Electricity Cost Calculator: appliance wattage, hours/day, days, unit rate and
   fixed charge, with a clear flat-tariff limitation (no invented slabs).
5. Fuel Cost Calculator: distance, mileage, price, trip/return and per-person cost,
   with transparent assumptions.

For every tool: usable UI and validation, safe shareable inputs, unique registry
metadata, contextual related links, hand-written guide + FAQs, engine and DOM
regressions; rebuild, OG if required, full check, one PR and production verification.
Keep Batch-3 GSC measurement separate. Full real-browser Lighthouse/accessibility
and PWA validation remain outstanding from Batch-5.

Implementation: 111 tools / 51 hand-written guides, five shareable calculator
interfaces and worked examples, at least three related-tool inbound sources per
new tool. Tests cover zero rates, already-funded goals, SWP depletion/partial
withdrawal, impossible/zero-weight exam targets, validation and all five shared
links. Financial projections assume a constant nominal annual rate divided by
12, no fees or tax; actual results can differ. Electricity uses a flat tariff.
Final check results are recorded in README; publication awaits PR checks.

---

## BATCH-7 — Private document and JSON workflows (2026-11-05)

Market scan: PDF page organizers and structural JSON compare are established
workflows, distinct from our existing PDF split/rotate and line-based text diff.
This is qualitative competitor evidence, not verified search-volume data. Aim for
useful local processing, not duplicate pages or unsupported feature claims.

One complete branch/PR:
1. PDF Page Organizer: locally load one unencrypted PDF, list numbered pages,
   reorder, remove, restore and rotate individually with keyboard-friendly
   buttons; export a new file using the existing vendored pdf-lib. No thumbnail
   or visual-preview claim. Warn that forms, bookmarks and signatures may change.
2. JSON Compare: safely compare parsed JSON structurally, ignore object key order,
   keep array order, report added/removed/changed JSON Pointer paths, invalid
   input and bounded work/output; no uploading or URL sharing of document data.
3. Repair existing PDF input drag/drop and duplicate-name file selection bugs in
   merge/image-to-PDF; ensure list removal updates totals and exported order.
4. Add distinctive hand-written guides, FAQs, contextual links, registry/search,
   realistic engine, actual PDF export and DOM tests; build, full check, one PR,
   merge and verify production if checks allow. Keep GSC measurement independent.
5. Real-browser Lighthouse, accessibility and device PWA checks remain pending;
   report limits honestly rather than inventing scores.

Implemented: 113 tools / 53 guides, including the organizer and structural
JSON compare. PDF drop handlers now work and duplicate filenames keep separate
file identities; removal updates size totals. The worker revalidates HTTP-cached
assets to reduce old-bundle/new-page mismatches after deploys. The organizer uses numbered pages,
not previews, and is limited to 500 pages / 200 MB. JSON comparison is limited
and uses JavaScript numeric parsing, with caveats documented. Verified locally:
177 engine + 64 DOM + 9 chrome + 20 integrity checks, plus worker regression
suite. DOM tests exercise real PDF exports and duplicate-name PDF merge, and
pure tests check source and output page geometry/rotation. PR/deployment and
real-browser/device verification are separate from these automated results.

---

## BATCH-8 — Loan, inflation, work and business planning (2026-11-06)

Market review is qualitative (not independently verified search-volume data):
competitor catalogues feature loan prepayment, inflation, work hours and profit
margin. These cover distinct decisions missing from the 113-tool catalogue.
Avoid thin pages and do not imply official rates, payroll/legal rules or returns.

Single branch/PR plan:
1. Loan Prepayment Calculator: compare the remaining loan against a fixed-EMI
   scenario with optional extra monthly payment and one lump sum; cap the last
   payment, show interest/time saved and clearly state timing and exclusions.
2. Inflation Calculator: future cost and purchasing power using a user-supplied
   constant annual rate and horizon; zero-rate case and no official CPI claim.
3. Work Hours Calculator: clock-in/out, overnight shift, breaks and optional
   gross hourly pay; equal times = zero, no payroll or DST assumptions.
4. Profit Margin Calculator: cost, selling price, profit/loss, margin and markup;
   handle zero cost, negative profit and zero revenue honestly.
5. Full UIs, validation, safe share links, guides/FAQs and contextual links;
   worked examples and boundary-case engine + DOM tests, generated pages, full
   check, one PR and live deployment verification if checks pass. GSC measurement
   and the outstanding real-browser Lighthouse/PWA audit remain separate.

Implementation: 117 tools / 57 guides; four working shareable calculators, each
with at least three inbound related-tool links. Engine tests cover zero-interest,
partial/capped prepayments, invalid amortization, inflation, overnight breaks,
losses and undefined ratios; DOM tests exercise all four shared-link examples.
Full check passed: 182 engine, 68 DOM, 9 chrome, 20 integrity checks and the
service-worker regression suite. Loan and inflation figures are assumptions,
not official quotes; work hours exclude payroll rules and DST. Browser/device
Lighthouse and PWA verification remains pending.

---

## ✅ BATCH-9 — Working-day planning and image-tool reliability (2026-11-06)

Qualitative market scan: business-day tools often offer deadline calculations,
custom holidays and regional weekends; image suites highlight local handling and
size reduction. No search-volume or ranking claims are inferred. Our Date
Difference already counts weekdays, so do not create a duplicate counter: add a
Business Day Calculator that supports custom holidays/weekends and date offset,
while strengthening the existing date and image workflows.

One batch on this branch:
1. Business Day Calculator: count inclusive dates and add/subtract working days,
   selectable weekend, explicit user-entered holidays, strict date validation and
   bounded range; no automatic or claimed official holiday database.
2. Repair all image-tool upload/dropzone callbacks, stale output and relevant
   file-lifecycle issues; target the existing compressor UX rather than creating
   thin duplicate pages. Test both file selection and dropped files.
3. Fix confirmed Date Difference hours and Date Add timezone display bugs with
   regression tests; avoid claiming elapsed DST hours as actual time.
4. Add a guide, FAQs, related links, pure/DOM regression tests and generated
   pages, run full check, one PR and production verification when ready. GSC and
   real-browser Lighthouse/PWA audit remain separate and pending.

Implementation ready for review: 118 tools / 58 guides. Holiday rules and
endpoint conventions are explicit; image picker/drop paths and stale previews
are tested with simulated canvas/decoders (not real-browser validation). Local
checks: 185 engine, 71 DOM, 9 site chrome, service worker and 20 integrity.
PR #15 merged; production READY/PROMOTED and live page verified.

---

## 🚧 BATCH-10 — Everyday money and small-business planning (2026-11-06)

Market scan of calculator directories (PrintSheetLab and MJK Tools) shows
budget, emergency fund, debt-to-income and break-even workflows. This is
qualitative competitor evidence, not verified demand or search-volume data.
Avoid duplicating Profit Margin or Loan Prepayment: each new tool answers a
distinct question. One batch on the current branch:

1. Build four currency-neutral calculators: 50/30/20 budget targets plus actual
   comparison, emergency fund target and gap, gross debt-to-income ratio, and
   unit-sales break-even with no-contribution handling. Explicitly document
   assumptions; no approval, savings or financial-advice promises.
2. Add distinct original guides, verified examples, FAQs, cross-links, sharing
   and prefilled URL state, with bounded and validated inputs and safe rendering.
3. Add engine edge cases and interactive DOM/share tests, regenerate static
   content, update counts, run all checks, review the diff, then one PR with CI
   and production verification. No paid services; real-browser audit and GSC
   follow-up remain separate pending tasks.

Implementation ready for review: four tools, 122 tools / 62 guides. Share
links expose entered amounts in the URL, so each UI warns users. All local
checks pass: 190 engine, 76 DOM, 9 chrome, service worker and 20 integrity.
PR/CI and production verification pending until actually completed.

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
