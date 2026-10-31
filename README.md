# iHaveTools

**90 free online tools. No sign-up, no uploads, no limits.** Every tool runs
entirely in your browser — your files and text never leave your device.

**Live site:** https://ihavetools.web.app/ (primary) ·
https://i-have-tools.vercel.app/ (Vercel mirror, auto-deployed from `main`)

## Categories (16)

PDF & Documents · Image · Video · Audio · Text · Calculators · Converters ·
Developer · Security · Web & SEO · Color · Data · Math · Date & Time ·
Student · Miscellaneous

Every category contains real, working tools. There are no "coming soon" cards,
placeholder buttons or empty sections anywhere on the site — a test in the
suite enforces this.

## Highlights

- **PDF tools** — merge, split, rotate and compress PDFs in the browser via
  [pdf-lib](https://github.com/Hopding/pdf-lib) (bundled locally, no CDN).
- **Image tools** — compression, resizing, format conversion, cropping and
  EXIF inspection using the browser's own canvas and decoders.
- **Audio / Video tools** — tone generation, audio trimming, speed/volume
  changes, video→audio extraction (Web Audio API) and an MP4 box inspector
  written from scratch. All pure client-side, output as 16-bit WAV.
- **Developer tools** — JSON format/validate/minify, regex tester, JWT
  decoder, formatters and encoders — all implemented in this repo, no
  external services.
- **Security tools** — password generator & strength checker, hashes and
  randomness built on the browser's cryptographic APIs (`crypto.getRandomValues`,
  `crypto.subtle`).

## Architecture

Static-first and dependency-free at **runtime**:

```
assets/js/
  registry.js      ← single source of truth: every tool, category, blurb, SEO text
                     (build-time only — browsers never download it)
  search-index.js  ← GENERATED slim index for search, loaded lazily (16 KB vs 71 KB)
  ui.js            ← shared UI primitives (inputs, dropzone, results, tables)
  icons.js         ← hand-drawn SVG icon set; static pages reference a cached
                     sprite (/assets/icons/sprite.svg) generated from it
  site.js          ← behaviour only: theme, nav toggles, search, service-worker
                     (header/footer HTML itself is rendered at build time)
  tools/*.js       ← engines grouped by domain (developer.js, image.js, audio.js, …)
sw.js              ← service worker at the domain root (whole-site scope)
scripts/
  build.mjs        ← generates every HTML page (home, categories, tools,
                     about/privacy/terms, 404), sitemap, llms.txt, sprite,
                     search index — all from registry.js
  test-tools.mjs   ← 148 engine tests (pure logic, run in Node)
  test-dom.mjs     ← 44 DOM tests: loads built pages into jsdom and drives real UIs
  test-chrome.mjs  ← 8 chrome tests: homepage, search, categories, theme, nav
  link-check.mjs   ← 19 integrity checks: dead links, sitemap↔files, SEO meta,
                     performance & trust invariants (no registry in browser…)
```

See **PLAN.md** for the SEO/speed roadmap (what is done, what is next).

- Pages are **pre-rendered at build time** (`node scripts/build.mjs`) with full
  per-page SEO: unique title/description, canonical URL, Open Graph/Twitter
  cards and JSON-LD (`WebApplication`, `FAQPage`, `BreadcrumbList`).
- The registry powers the homepage grid, category pages, search index,
  sitemap and related-tools sections — nothing is hand-copied.
- **No user data ever touches a server.** There is no backend: hosting serves
  static files only. File tools process bytes in browser memory via FileReader,
  Canvas, Web Audio and pdf-lib.
- **Privacy claims are enforced, not decorative**: any page promising "never
  uploaded" is backed by code with no network calls handling user input.

## Development

```bash
npm install          # devDependencies only (jsdom, sharp, pdf-lib, playwright*)
npm run build        # regenerate all HTML from the registry
npm test             # engine tests (148)
npm run test:dom     # DOM tests against built pages (44)
npm run test:chrome  # chrome tests (8)
npm run check        # build + engine tests + link/integrity checks
```

\* `playwright` is optional and only used for manual visual checks; the CI and
all automated tests run on jsdom.

Add a new tool by adding one `T({ ... })` entry to `assets/js/registry.js` and
a matching def in the right `assets/js/tools/*.js` engine module, then run
`npm run check` — page, sitemap entry, search index, related links and SEO are
generated automatically.

## Deployment

Firebase Hosting serves the repo root as-is (`firebase.json`). CI (GitHub
Actions) builds and runs all four test suites on every push/PR to `main`.

## License

MIT — see [LICENSE](LICENSE).
