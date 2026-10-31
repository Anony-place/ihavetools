# iHaveTools — Best Tool Site Banane Ka Plan (SEO + Speed Roadmap)

> **Goal:** Site ko Google par fast rank karana + har page lightning-fast banana,
> taaki iHaveTools ek best-in-class free tools site bane.
> **Date:** 2026-10-31 · **Current state:** 80 tools, 16 categories, static site
> (Firebase Hosting), har tool browser me chalta hai (no upload) — base solid hai.

---

## 1. Audit me kya mila (sacchi report)

### ✅ Pehle se achha hai
- Har page ka unique title/description, canonical, Open Graph, JSON-LD schema,
  sitemap.xml, robots.txt, breadcrumbs, FAQ sections.
- 100% static + no framework + system fonts → inherently fast.
- PDF library (525 KB) already lazy-load hoti hai, sirf PDF tools par.
- Test suite strong hai (engine + DOM + chrome + link-check).

### 🔴 Critical problems (rank/speed rokne wale)

| # | Problem | Asar |
|---|---------|------|
| 1 | **Service Worker dead hai** — code `/sw.js` register karta hai, file `/assets/sw.js` par hai. PWA/offline/cache kaam hi nahi kar raha. | Repeat visits slow, PWA fail |
| 2 | **Har page 71 KB ki registry.js load karta hai** (saare 80 tools ka saara data) — sirf header/search ke liye. | Har tool page par extra JS parse time, slow INP/LCP |
| 3 | **Homepage ka 58% HTML (37.8 KB/65 KB) repeated SVG icons hai** — har icon har card me dobara paste. | Homepage heavy, slow first paint |
| 4 | **Header nav JS se banta hai** — category links HTML me hi nahi hain. | SEO internal-linking kamzor, layout shift (CLS) |
| 5 | **Build reproducible nahi hai** — `build.mjs` relative paths (`../../`) banata hai, live site absolute (`/assets/`) hai. Next build sab tod dega. | Khamosh bomb 💣 |
| 6 | **72/80 tools par sirf 2 generic FAQ** ("Is it free?") — thin/duplicate content. | Google ko rank karne ko content hi nahi |
| 7 | **About / Privacy Policy / Terms pages nahi hain.** | E-E-A-T/trust fail, AdSense approval mushkil |
| 8 | **firebase.json me cache/security headers nahi hain.** | Repeat load slow, Lighthouse best-practices down |
| 9 | **Sitemap me `lastmod` har build par "aaj" ho jata hai** (jhoothi freshness). | Google lastmod ko ignore kar deta hai |
| 10 | Homepage H1 *"Every tool you need"* — target keyword **"free online tools"** H1 me nahi. | Home ka main keyword weak |

---

## 2. Phase 1 — Technical SEO + Speed (✅ IS TURN ME HO RAHA HAI)

### Speed (Core Web Vitals)
- [x] Service Worker fix: `/sw.js` root par, stale-while-revalidate caching,
      har HTTPS host par register (sirf localhost/preview par nahi).
- [x] **Slim search index**: full 71 KB registry ki jageh ~15 KB ka
      `search-index.js`, woh bhi **lazy** — sirf search use hone/idle par load.
      Tool pages par registry load hona band.
- [x] **SVG sprite**: har page par icon paths ek hi baar, cards sirf `<use>`
      reference karenge → homepage HTML ~65 KB → ~35 KB expected.
- [x] **Static header/footer HTML** (build-time): nav, category dropdown,
      mobile menu, theme button — bina JS ke render. No CLS, crawlable links.
- [x] `modulepreload` tool engine + UI ke liye → tool turant interactive.
- [x] **Speculation Rules** (prefetch on hover) → next page lagbhag instant.
- [x] Firebase cache headers: assets 1 din + stale-while-revalidate,
      icons/images 30 din, HTML no-cache, `sw.js` no-cache + security headers.
- [x] `content-visibility` cards par → homepage ke 118 cards ka render sasta.
- [x] Build fix: `ROOT_PREFIX = '/'` lock — build ab live site jaisa hi output dega.

### SEO
- [x] Homepage H1 keyword-first: **"Free Online Tools for Everyday Work"**.
- [x] Tool pages par rich content: *"What is X?"* section + 4 FAQs
      (har tool ke apne description/aliases se bane — duplicate nahi).
- [x] Related tools 4 → 6, `related` override respect, category browse link.
- [x] Structured data upgrade: Organization + WebSite `@graph`,
      `WebApplication` (price 0, dates, publisher), `HowTo` steps,
      category `ItemList`.
- [x] **About / Privacy Policy / Terms** pages + footer links + sitemap.
- [x] Sitemap honest `lastmod` (tool ki `added` date), faltu tags hatae.
- [x] `llms.txt` — AI search (ChatGPT/Perplexity/Gemini) ke liye tool list.
- [x] Meta descriptions CTR-style: *"X online — … Free, no sign-up…"* (~155 chars).
- [x] High-value alias redirects (`/tools/merge-pdf/` → `/tools/pdf-merge/` etc.)

---

## 3. Phase 2 — Growth: naye high-traffic tools

**Status (2026-10-31):** SIP ✅, PPF ✅, FD ✅, Image to PDF ✅ — live.
Site ab **Vercel par bhi live hai: https://i-have-tools.vercel.app**
(`vercel.json` — outputDirectory `.`, headers/redirects Firebase ke mirror).
Canonical primary abhi `ihavetools.web.app` hi hai taaki ranking split na ho;
custom domain aate hi ek baar me switch hoga.

| Tool | Status |
|------|--------|
| **SIP Calculator** | ✅ live (2026-10-31) |
| **PPF Calculator** | ✅ live (2026-10-31) |
| **FD Calculator** | ✅ live (2026-10-31) |
| **Image to PDF** | ✅ live (2026-10-31) |
| **Income Tax Calculator (India FY 2025-26)** | ⏳ next (slabs + 87A rebate) |
| **JPG↔PNG / WebP converter preset pages** (programmatic SEO) | ⏳ next |
| **QR Code Generator** | ⏳ next (encoder likhna hai) |
| **YouTube Thumbnail Downloader** | ⏳ next |

Saath me:
- [ ] Per-category OG images (1200×630) — social CTR.
- [ ] Top-15 popular tools ke liye hand-written deep content
      (examples, formulas — jaise BMI formula table, JSON errors guide).
- [ ] Cmd-K / global search har page par (header search box).
- [ ] ⭐ Favorites + "Recently used" (localStorage) — retention.
- [ ] Tool pages par share/copy-link, result share (calculators me `?amount=` params).

## 4. Phase 3 — Off-code ranking kaam (bhai, ye tumhe karna hoga — code se nahi hota)

1. **Custom domain** ⭐ Sabse bada factor. `ihavetools.web.app` ki jageh apna
   domain (e.g. `ihavetools.com`) Firebase par connect karo → phir
   `assets/js/registry.js` me `site.url` badal kar rebuild. Subdomain par
   rank karna mushkil hota hai (domain authority tumhari nahi banti).
2. **Google Search Console**: property add karo, `sitemap.xml` submit karo,
   top-20 tool pages ki "Request Indexing". Coverage report hafte me dekho.
3. **Bing Webmaster Tools** + IndexNow (Bing/Yandex fast index) — 10 minute ka kaam.
4. **Backlinks**: Product Hunt launch, Reddit (r/InternetIsBeautiful,
   r/webdev — spammy nahi, genuine), dev.to/Hashnode article
   *"80 tools jo browser me chalte hain, bina upload ke"*, tool directories
   (AlternativeTo, SaaSHub, Toolify), GitHub awesome-lists me PR.
5. **Analytics**: privacy-friendly (Plausible/GoatCounter — free tier) lagao
   taaki pata chale kaunse tools chal hain. Privacy Policy usi hisaab se update.
6. Hafte me 2–3 naye tools ya ek tool ka content deep-karo — consistency hi
   tool-sites ko rank karati hai. Rankings **2–6 mahine** me aati hain;
   isiliye Phase-2 wale high-volume tools pehle.

## 5. Phase 4 — Monetization ready (traffic aane ke baad)
- AdSense (Privacy/Terms/About ab ready hain), ads ko tool-panel ke bahar —
  UX/speed kharab nahi karni, warna ranking girti hai.
- PWA install prompt (SW ab thik hai), browser extension (search palette).

---

## Kaam kaise verify hoga
Har change ke baad: `npm run check` (build + 148 engine + 44 DOM + 8 chrome
+ link-check). Ek bhi tool toota to change reject. Speed ka pehle/baad ka
size comparison PR description me milega.
