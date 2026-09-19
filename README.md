# iHaveTools

**80 free online tools. No sign-up, no uploads, no limits.** Every tool runs
entirely in your browser — your files and text never leave your device.

**Live site:** https://ihavetools.web.app/

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
  ui.js            ← shared UI primitives (inputs, dropzone, results, tables)
  icons.js         ← hand-drawn inline SVG icon set (no icon font, no requests)
  site.js          ← chrome: theme, nav, global search, service-worker
  tools/*.js       ← engines grouped by domain (developer.js, image.js, audio.js, …)
scripts/
  build.mjs        ← generates every HTML page from registry.js (content + SEO)
  test-tools.mjs   ← 148 engine tests (pure logic, run in Node)
  test-dom.mjs     ← 44 DOM tests: loads built pages into jsdom and drives real UIs
  test-chrome.mjs  ← 8 chrome tests: homepage, search, categories, theme, nav
  link-check.mjs   ← 15 integrity checks: dead links, sitemap↔files, SEO meta
```

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
