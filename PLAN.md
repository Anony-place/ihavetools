# iHaveTools — Pura Plan (Complete Roadmap)

> **Goal:** Google par rank karne wali, lightning-fast, best-quality free tools site.
> **Updated:** 2026-11-07 · **Live:** https://i-have-tools.vercel.app (Vercel,
> `main` par merge = auto-deploy) · **Tools:** 133 (98 guides)
>
> **🧭 KAAM KARNE KA RULE (2026-11-01 se):** Chhote-chhote changes ke liye
> baar-baar branch nahi banega. **Pehle ye pura plan, phir ek branch = ek
> BADA batch = ek PR.** Har batch ke end par: `npm run check` full green →
> PR → CI + Vercel preview pass → merge → production verify → PLAN tick.

---

## Sitemap quality and discovery batch — plan

Google’s [sitemap guidance](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap)
recommends canonical URLs and accurate significant modification dates; it ignores
changefreq and priority and submission does not guarantee indexing. Competitor
features and unverified/future-dated Search Console exports are not demand or
traffic evidence. Continue useful SEO development without waiting for metrics.

1. Improve the sitemap generator against duplicate normalized URLs and make the
   single shared lastmod setting explicit; preserve its scope and existing URLs.
2. Replace misleading fixed-length metadata advice with Google-aligned guidance,
   and add practical guides for metadata and sitemaps.
   Cover sitemap publishing,
   canonical selection, accuracy, size and indexing caveats; connect existing
   robots and sitemap workflows with clear guidance.
3. Add unit, DOM and static SEO regressions; run full checks, security audit and
   browser CI in one PR, merge if green and verify the live page.

---

## Search quality and technical SEO batch — plan

Google's [people-first content guidance](https://developers.google.com/search/docs/fundamentals/creating-helpful-content)
prioritizes useful, reliable content; its [title guidance](https://developers.google.com/search/docs/appearance/title-link)
recommends descriptive, concise titles and avoiding repetitive boilerplate.
No valid comparable GSC export has been verified, so impact on traffic, demand
or rankings cannot be measured here. Existing competitor examples are feature
signals, not market-volume estimates.

1. Remove auto-generated alias-list paragraphs and generic alias/install FAQs
   across tool pages; retain functional category links, real FAQs and local
   search aliases. Use the actual tool description for meta snippets rather than
   repeating the name and generic promises; Google may choose its own snippets.
2. Add specific, implementation-checked examples, limitations and troubleshooting
   for JSON Validator, Regex Tester and CSV to JSON. Preserve canonical routes,
   related links, metadata consistency and sitemap; do not invent modification
   dates or promise rich results.
3. Add regression checks for generated copy, unique metadata, FAQ/schema parity,
   crawlable routes and no-JS content; run full checks, audit, browser CI, one PR,
   merge when green and verify live HTML. Follow up with correctly dated GSC
   exports, page-filtered queries and equal windows before claiming traffic gains.

---

## Student grade planning batch — plan

[Calculator.net Grade Calculator](https://www.calculator.net/grade-calculator.html)
uses weighted assignments and planning for remaining tasks. This is a competitor
feature signal, not measured keyword demand. Site-specific traffic comparison is
still unverified; the only located export has a date later than this session.
Don't invent traffic numbers or rank promises.

1. Extend the existing final-grade calculator with a local, optional completed
   coursework planner: percentage score and whole-course percentage weight per
   line, remaining-weight calculation and explicit apply to the existing model.
2. Explain assumptions: disjoint course weights, one aggregate remaining score,
   no letter-grade conversion, dropped grades, rounding rules or extra credit;
   avoid incorrect results for empty, invalid, zero or excessive weights.
3. Clear stale results and generated share links; test boundaries, edits, apply,
   precision, mobile accessibility and the existing share workflow. Full checks,
   audit and one PR; merge only with green CI and verify production.

---

## Roman date conversion and traffic validation — plan

Traffic: Drive search found one site-specific Search Console spreadsheet labelled
2026-11-12, later than the session date 2026-10-31. Do not treat it as current
or report its metrics until chronology is verified. No comparable page-filtered
periods or total site traffic are available here. Prioritize a useful workflow
hypothesis rather than claiming measured demand or a ranking benefit.

Market: [RapidTables Roman converter](https://www.rapidtables.com/convert/number/roman-numerals-converter.html)
links to a date conversion workflow and a chart. Competitor functionality is
not search volume. Our converter supports standard numbers already; extend the
same page with a clearly labelled Gregorian date ↔ Roman date workflow, explicit
component order, strict date validation, and no zero or overline notation.

1. Build local bidirectional conversion with unambiguous slash-separated parts,
   explicit day/month ordering and strict Gregorian leap-year validation.
2. Explain calendar, ordering and scope limitations; keep current converter
   behavior and canonical URL unchanged. Avoid unsupported traffic claims.
3. Test valid and invalid dates, Gregorian century leap rules, both orders,
   round trips, copy/output clearing, mobile and accessibility; run full checks,
   audit, one PR, CI, merge only when green and verify production.
4. Later, acquire a correctly dated GSC export and compare equal windows with
   page-filtered queries; do not stall feature work waiting for it.

---

## Image resizer workflow batch — plan

[ResizePixel](https://www.resizepixel.com/resize-image/) offers aspect-ratio
resizing and target file sizes; [iLoveIMG](https://www.iloveimg.com/resize-image)
offers pixel dimensions and bulk resizing. These are competitor features, not
measured search demand. Bulk resizing already exists here; improve the single
image workflow instead. A comparable verified GSC export is still outstanding,
so no keyword-volume or ranking claims are made.

1. Add JPEG/WebP quality and optional best-effort target KiB with verified output
   sizes, using the existing bounded encoder; clearly explain PNG limitations.
2. Repair ratio lock when toggling or replacing a file, prevent zero-pixel
   calculated dimensions, clear previous output on edits and handle async races.
3. Test real downloaded image dimensions, size and format, failure paths, ratio
   controls and mobile accessibility; run full checks, audit, one PR, CI and
   production verification. All processing remains in-browser and free.

---

## Today's consolidated PDF page workflow — plan

Market evidence: [iLovePDF Rotate](https://www.ilovepdf.com/rotate_pdf) offers
rotation, and [PDF24 Remove Pages](https://tools.pdf24.org/en/remove-pdf-pages)
offers odd/even selection. These are competitor capabilities, not independent
search-volume estimates. The latest matching Drive performance export available
is labelled 2026-11-12; a comparable verified 14-day export is not available in
this pass, so do not infer market size or rankings. Google Trends is sampled and
normalized rather than absolute search volume. Continue the zero-cost,
browser-local approach without waiting for GSC.

1. Improve PDF Organizer with range removal, bulk current-page rotation, and
   one-step undo for page edits; preserve current order, per-page rotations and
   original-page numbering semantics, and prevent empty exports.
2. Add odd/even original-page rotation scopes to PDF Rotate without changing its
   all/range defaults. Preserve existing rotations and invalidate pending work.
3. Test original-page parity, range errors, undo, stale export, byte-level PDF
   output, rotation, mobile accessibility and limits. Full checks, security
   audit, one PR, CI/preview, merge only when green, verify production. No paid
   services or uploads; signatures and document metadata may not survive edits.

---

## Date planning and epoch conversion batch — plan

[Epoch Converter](https://www.epochconverter.com/) offers UTC/local date input;
[timeanddate](https://www.timeanddate.com/date/workdays.html) allows custom
weekday exclusions and end-date options. These are competitor feature signals,
not measured demand. Add explicit UTC/local date-time input with seconds and
milliseconds to the timestamp converter, reject normalized invalid dates and
explain DST ambiguity and rounding. Extend business-day planning with custom
non-working weekdays and optional end-date inclusion while preserving defaults,
manual-holiday and offset conventions. Add independent vectors, boundary,
race/invalidation and real-browser mobile tests; one CI-verified PR and production
verification. No paid service. GSC comparison and tax audit remain open.

---

## Developer encoding and checksum verification batch — plan

[URL Encoder](https://www.urlencoder.org/) illustrates per-line processing;
[online-tools SHA-256](https://emn178.github.io/online-tools/sha256_checksum.html)
explains checksum comparison and its authenticity limits. These are feature
signals, not measured search demand. Add bounded per-line URL encoding/decoding
with a downloadable result, explicit JavaScript URI semantics and line-specific
errors. Add optional expected hex digest comparison to text/file hashing, validate
length for the chosen algorithm, guard async races and explain trust limits.
Preserve default behaviour, test encoded output, malformed lines, hashes, stale
results, real-browser downloads and mobile accessibility; ship one PR only after
full CI and preview. No paid service; GSC comparison and tax audit remain open.

---

## Base64 binary workflow and safety batch — plan

[Base64Decode](https://www.base64decode.org/) describes binary file decoding;
this is competitor feature evidence, not measured demand. Add a separate local
binary file encode/decode workflow with bounded size, explicit .txt/.bin downloads,
strict Base64 validation and UTF-8 validation for encoded text files. Keep text
conversion and URL-safe behaviour, protect against stale asynchronous reads and
invalidate prepared output when input or settings change. Explain that Base64
is not encryption, decoded files can be dangerous, and this is not a data URL or
per-line parser. Test byte-for-byte round trips, invalid input, races, limits and
mobile accessibility; run full CI and preview before one PR and production
verification. No paid services. Historical GSC comparison and tax audit remain
unverified.

---

## Text sorter delimiter workflow — plan

[TextFixer](https://www.textfixer.com/tools/alphabetical-order.php) illustrates
independent input and output separators, a competitor feature signal rather than
measured demand. Extend the local sorter to handle simple line, comma and
semicolon lists with optional trimming, keeping existing defaults and sorting
semantics. Explicitly reject any implication of CSV parsing: separators inside
quoted text are not special and output may be ambiguous. Bound item counts,
invalidate stale outputs and imports, add engine, DOM and real-browser/mobile
coverage, then ship one PR only after CI and preview pass. No paid service.
Historical GSC comparison and tax audit remain unverified.

---

## Text counter consistency batch — plan

Improve Character Counter and Line Counter together: bounded live processing,
local strict UTF-8 text import, copyable current statistics, and explicit line,
Unicode and platform-limit semantics. Invalidate stale import reads on edits,
clear and navigation; preserve existing text on failed imports. Add regression
tests for limits, final newline, Unicode and import failure; run checks and one
CI-verified PR before production verification. Existing platform examples are
heuristics, not guaranteed service limits. No paid service. Historical GSC
comparison and tax audit remain unverified.

---

## PDF-to-image export controls batch

Plan first: [PDF24](https://tools.pdf24.org/en/pdf-to-images) offers resolution,
quality and grayscale; this describes competitor features, not market demand.
Extend our existing local PDF-to-Image tool with JPEG quality, color/grayscale,
extra clockwise quarter-turn rotation and an additional high-resolution preset.
Apply the same validated options to single-page preview/download and multi-page
ZIP, keep white background and existing pixel/size limits, invalidate pending
results on settings edits, and explain pixel memory and rendering fidelity limits.
Verify actual decoded image pixels, dimensions, ZIP entries, invalid settings,
render cancellation, accessibility, full CI, preview and production. One PR,
no paid service. GSC comparison and tax audit remain unverified.

---

## Image-to-PDF layout and safety batch

Plan first: [iLovePDF](https://www.ilovepdf.com/jpg_to_pdf) describes page
orientation and margin options; this is a competitor feature signal, not measured
demand. Extend the existing local Image to PDF workflow with A4/Letter orientation
and adjustable margins, transparent PNG fallback for browser-decoded formats,
and explicit queue, pixel and output limits. Keep default behaviour and image-size
mode clear; explain animation, EXIF, OCR, memory and input format limitations.
Invalidate pending conversions on all settings and queue changes, reject invalid
batches without partial additions, and test actual page geometry, output, alpha,
invalid input, limits, stale actions, mobile accessibility, CI and production.
One consolidated PR, no paid services. Historical GSC comparison and tax audit
remain unverified.

---

## PDF merge selection and safety batch

Plan first: [iLovePDF](https://www.ilovepdf.com/merge_pdf) shows ordered PDF
combination, a competitor feature signal rather than demand evidence. Extend the
existing local merger with optional per-file page ranges, preserving file order and
ascending selected page order. Bound the queue to 20 files / 200 MiB total, selected
pages to 500 and output to 200 MiB; reject invalid batches without silently dropping
files. Invalidate pending work on selection, range, clear or reorder changes; verify
real merged page order, invalid ranges, limits, cancellation, mobile accessibility,
CI, preview and production. Explain loss of document-level features and that these
limits do not guarantee a device has sufficient memory. One PR, no paid service.
GSC comparison and tax audit remain unverified.

---

## Slug and case editing workflow batch

Plan first: enhance existing Slug Generator and Case Converter together. Google’s
[URL structure guidance](https://developers.google.com/search/docs/crawling-indexing/url-structure)
recommends descriptive URLs, hyphens and percent encoding as necessary; it does
not guarantee ranking or global slug uniqueness. Add explicit invalid-title and
duplicate-slug diagnostics, optional batch-only collision-safe suffixes, local
bounded UTF-8 import and TXT downloads. Preserve multilingual content and existing
case options, clarify blank-line, Unicode, encoding and CMS uniqueness limitations.
Make import races, stale outputs and resource limits safe; test collisions, reserved
suffixes, Unicode, malformed files, downloads and mobile accessibility. Full checks,
preview and CI before merging one PR; no paid services. Historical GSC comparison
and tax audit remain unverified.

---

## Text-list cleanup workflow batch

Plan: [TextFixer](https://www.textfixer.com/tools/remove-duplicate-lines.php)
illustrates duplicate removal and optional sorting; this is competitor feature
information, not measured demand. Improve the existing Remove Duplicate Lines
and Text Sorter together: strict local UTF-8 .txt/.md import, bounded processing,
stale-read cancellation, downloadable results, and first/last duplicate selection
with optional sorting. Keep original retained line content and explain whitespace,
blank-line, case and LF normalization semantics. Invalidate stale results after
edits and failed imports; verify boundaries, races, empty lines, Unicode, download,
mobile accessibility and full CI before one PR/production deployment. No paid
service. GSC comparison and historical tax audit remain unverified.

---

## Word-counter writing workflow batch — 2026-10-31

Plan first: [WordCounter](https://wordcounter.net/) illustrates common writing
workflows including goals, upload and time estimates; this is competitor feature
evidence, not market volume. Improve our existing word counter with bounded local
UTF-8 .txt/.md import, configurable reading and speaking rates, optional minimum
and maximum word goals, and a coherent copyable summary. Retain existing basic
counts, but explain whitespace-token words, code-point characters, sentence and
Markdown limitations, and estimated time rounding; no ranking or precise speed
claims. Reject malformed files and invalid options, preserve input on failed
imports, cancel stale async reads, and clear results on oversized input. Test
boundaries, Unicode, goals, rate maths, race conditions, imported input, mobile
layout/accessibility, CI and Vercel preview. One consolidated PR, no paid service.
Also add a custom code-point character limit to the related Character Counter,
with honest platform and search-snippet caveats and boundary tests.
Market volume, GSC chronology and tax audit remain open.

---

## Keyword editing workflow batch — 2026-10-31

Plan: improve the existing Keyword Density & Frequency Checker, not duplicate
pages. [SEO Review Tools](https://www.seoreviewtools.com/keyword-density-checker/)
describes text/phrase frequency and filters; that is competitor feature evidence,
not measured market demand. Support an optional bounded list of target phrases,
independent of automatic phrase filters, with a separate local CSV report. Retain
the existing single target, overlap rules and honest tokenization/density limits.
Reject invalid targets and bounded work rather than freeze; clear stale output on
edits and protect imports from races and malformed UTF-8. Tests cover Unicode,
zero/overlap, duplicates, quotas, import rejection, CSV, mobile and accessibility.
[Google](https://developers.google.com/search/docs/essentials/spam-policies#keyword-stuffing)
warns against keyword stuffing; no ideal density or ranking promise. Local only,
no paid services. One consolidated PR, full CI and preview before production.
Search Console chronology and market volume remain unverified; tax audit pending.

---

## Bulk image cover-crop batch — 2026-10-31

Plan: extend the established bulk image workflow, not create a duplicate page.
[iLoveIMG](https://www.iloveimg.com/crop-image) demonstrates pixel cropping,
while its [bulk image suite](https://www.iloveimg.com/) demonstrates batch
workflows. These are competitor feature signals, not measured demand. Add exact
canvas cover cropping with explicit center/edge positioning after rotation and
mirroring. Require both dimensions, never silently enlarge when disabled, and
report a per-file failure rather than distort or pad when enlargement is needed.
Preserve fit/padding, alpha and white JPEG background, watermark order, existing
ZIP and memory limits, and invalidate stale outputs. Explain that crop removes
edges and is not automatic subject detection; preview and inspect every image.
Add an on-demand selector to preview every successful output, not only the
first, while maintaining one preview URL at a time. Test preview switching and
invalidation, geometry, pixel colors, rotation, ZIP, failures and mobile UX.
One consolidated PR and full CI/preview before production. No paid dependencies,
volume estimates or ranking claims. GSC chronology and tax audit remain open.

---

## Image crop workflow batch — 2026-10-31

Plan: improve the existing local image cropper instead of adding duplicate pages.
[iLoveIMG](https://www.iloveimg.com/crop-image) demonstrates pixel-rectangle
cropping; this is competitor feature evidence, not measured demand. Add PNG,
JPEG and WebP export with lossy quality control, a white background for JPEG,
more portrait/landscape aspect presets and reset selection. Preserve pixel
coordinates, bounded output, local processing and stale-output cancellation.
Clearly disclose animation, transparency, metadata and encoder caveats; detect
unsupported browser encoders instead of mislabelling PNG fallback (see
[MDN](https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/toBlob)).
Test real exported formats, pixels, alpha, JPEG background, UI invalidation,
limits and mobile accessibility; one PR, CI and preview before production.
Also fix the existing Image Converter’s inaccurate quality claim by actually
providing bounded JPEG/WebP quality controls, including preset converter pages;
reject invalid quality, invalidate stale output and test actual encoded files.
No paid dependencies or ranking/volume claims. Historical GSC comparison,
chronology reconciliation and tax audit remain outstanding.

---

## Search-signal usability and market research batch — 2026-10-31

Plan first: audit the three GSC-observed pages, then research competitor features
and demand signals; the supplied report is labelled Nov 2026, later than the
session date, so its dates require reconciliation and cannot be treated as
verified current data. Site impressions are not total market demand. Improve
actual user workflows rather than creating keyword-only pages: Roman conversion
gets a copyable result and numeric/symbol breakdown; attendance gets an optional
finite remaining-class plan with exact target arithmetic and clear assumptions;
robots rules get editing without deleting and re-entering, with preview/test
invalidation. Preserve existing APIs and privacy, and test arithmetic boundaries,
UI, accessibility, edits and generated content. Research competing PDF/image,
student and developer tools and document evidence separately from measured
market demand; no fabricated volume, paid service or ranking guarantee. One
consolidated PR: tests, security audit, CI/preview, merge and production verify.

### Continued growth batch — JSON validation workflow

Competitor evidence in MARKET-RESEARCH.md identifies local file loading and
validation as established workflows, not a measured demand estimate. Improve
the existing JSON Validator instead of publishing duplicate pages: add bounded
UTF-8 local JSON import, preserve existing text on failure, guard stale async
reads, and a keyboard-accessible jump to the first error. Invalidate stale
results immediately on edit; explain limits and duplicate-key warning. Test
errors, async races, mobile and accessibility alongside the three earlier tools.
Keep everything local and free. One existing PR; CI and preview before merge,
production checks afterward. No claim that these changes guarantee traffic.

---

## Selective PDF ZIP and custom ranges batch — 2026-10-31

Plan first: extend the existing local PDF Split workflow for selected pages and
custom groups rather than adding a duplicate tool. iLovePDF describes separating
one page or a set into independent files (https://www.ilovepdf.com/split_pdf);
PDF24 describes selective extraction (https://tools.pdf24.org/en/split-pdf).
These are product feature observations, not measured demand. Support a selected
page list for single-page or fixed-size ZIP output and semicolon-separated custom
sets, including discontiguous and intentionally overlapping sets. Keep group
order explicit and page order ascending; unique part names avoid ZIP collisions.
Limit total generated page copies to 100, including overlap, and PDF payload to
100 MiB; support bounded selection from larger source documents. Retain existing
one-PDF extraction, privacy, fidelity caveats, cancellation, and atomic download.
Test malformed input, resource limits, overlapping and noncontiguous sets, actual
ZIP/PDF contents, cancellation, mobile accessibility and regression. One PR,
full CI/preview, then merge and production verify. No paid services, no claims of
measured demand or ranking. GSC comparison and tax audit remain outstanding.

Implemented selected-page and custom-group ZIP export, including bounded
selection from documents larger than 100 pages, explicit overlap accounting and
stable part names. Engine, DOM cancellation, generated-site and audit checks pass.
Local Chromium 143 verified actual ZIP/PDF contents, custom overlap and mobile
axe; the full local run later timed out in the unrelated PDF-to-image render
test. PR #68 passed full CI, merged, and the updated page was verified on
production. Other browsers, physical devices and complex PDFs are unverified.

---

## PDF split workflow batch — 2026-10-31

Plan first: improve PDF Split in one consolidated batch. iLovePDF documents
splitting a page or set into independent PDF files (https://www.ilovepdf.com/split_pdf);
https://ilovedocstools.com/split/ describes fixed-size groups and ZIP delivery.
These are competitor feature observations, not measured demand. Replace fragile
multiple automatic download requests with one local ZIP, add equal-sized groups
and retain the existing single-PDF range extraction. Bound ZIP exports to 100
pages and 100 MiB generated PDFs; file input remains limited to 200 MiB. Use safe,
unique filenames and stable page order, reject invalid group sizes and encrypted
PDFs, cancel stale results, and explicitly warn about document-level features and
signatures. Test generated PDF pages, ZIP filenames and contents, partial groups,
limits, cancellation, mobile accessibility and regression. Keep all processing
local and free; one PR, CI/preview then merge and production verification. GSC
comparison and full tax audit remain open and do not block this work.

Implemented ZIP splitting for individual pages and equal groups, with explicit
limits and one atomic download. Unit, DOM cancellation and generated-site checks
pass; npm audit found no vulnerabilities. Local Chromium 143 verified ZIP
contents, ordering, partial groups and mobile axe; the full local run later timed
out on the unrelated PDF-to-image render test. Full CI browser suite, preview and
production verification were required before release. PR #67 subsequently passed
full CI, merged and was verified on Vercel production. Other browsers, physical
devices and complex PDFs remain unverified.

---

## JSON comparison workflow batch — 2026-10-31

Plan first: improve the existing JSON Compare rather than publish a duplicate
page. Competitor feature research shows formatting, swapping and review reports
are common workflows (https://formatter.org/json-compare and
https://jsonedit.com/compare-two-json); this is feature evidence, not measured
market demand. Add side-specific token-preserving formatting, swap, concise
added/removed/changed counts, and a copy/download text report. The report is a
review summary, not an executable JSON Patch: represent paths as quoted JSON strings (including empty root and escaped
control characters), clearly label truncated paths and value previews and
numeric precision limitations, and warn about sensitive data. Never claim exact
decimal comparison. Preserve side-specific import race protection; editing,
formatting, swap, failed compare and clear must invalidate old reports. Keep
processing local and existing limits; test boundaries, UI, stale async reads,
actual downloads, mobile accessibility, CI and deployment. One consolidated PR,
no paid services, no ranking promises. GSC comparison and tax audit remain open.

Implemented formatting, swap, summary and bounded review report. Engine, DOM,
full generated-site checks and npm audit pass. Local Chromium 143 passed JSON
Compare interaction, download and mobile axe checks, then timed out in an
unrelated PDF rendering test; full CI browser run and deployment verification are
required before release. Other browsers and physical devices are unverified.
PR #66 subsequently passed full CI and was merged and verified on Vercel.

---

## JSON navigation and comparison batch — 2026-10-31

Plan first: add a local JSON Pointer lookup tool using the existing bounded,
token-preserving JSON tree; return exact source tokens rather than reserializing
numbers. Support plain RFC 6901 pointers, escaped keys, strict array indices,
empty keys and the empty root pointer. Reject duplicate keys, malformed pointers,
missing paths and inputs beyond documented limits. Do not fetch remote data,
evaluate code, silently coerce numbers or claim JSONPath/fragment support.
Also harden existing JSON Compare file imports: reject malformed UTF-8 and prevent
pending reads from overriding a completed compare; preserve existing input on
failure. Full workspace, accessible controls, local file handling and ₹0 setup.
Add real browser extraction/download and race tests plus engine, DOM, mobile,
axe, regression and audit; one PR and verified release. Competitor features are
product signals, not measured market demand. JSON Schema validation remains a
separate feasibility problem, not part of this scope.

Implementation: JSON Pointer lookup and Compare import safeguards added, with
engine, DOM race, generated-site and browser coverage. `npm run check` and npm
audit pass. Local Chromium 143 passed the new pointer and compare interactions
and mobile axe, but the full browser run later timed out in the unrelated PDF
render test; CI must pass the complete browser suite before merge. Production
release is pending review and verification.

---

## Local text comparison and trust batch — 2026-10-31

Plan first: make existing Text Diff useful for real document workflows with two
independent local UTF-8 file inputs, per-side stale-read protection, line-numbered
results, an optional changes-only view, and copy/download of a plain-text report.
Keep exact line comparison and existing size limits; do not call the report a
patch, imply word-level diff or upload data. Preserve text on failed import;
clear/swap/compare must prevent pending reads from overwriting user work. Fix
misleading generated generic FAQ claims of unlimited usage: free does not mean
no processing/device limits. Competitor workflows are feature signals, not
measured search demand. Test real files, invalid UTF-8, concurrent reads, swaps,
line numbering, final newlines, report downloads, mobile/axe and regression
coverage. One consolidated PR; full checks, audit, CI and preview before merge,
then verify production.

Implemented local dual-file comparison, line numbers, changes-only view and
copy/download of a labelled non-patch report. Strict UTF-8 decoding, file/size
limits and side-specific revision guards retain user input on failure and prevent
stale reads after typing, swap, clear or compare. Generic FAQ and About page no
longer promise unlimited usage. Full checks, real Chromium file/report tests,
mobile axe and npm audit pass. Other browsers, physical devices, screen-reader
sessions and user testing remain open. CI/preview and production are release
gates.

---

## Local data conversion workflow batch — 2026-10-31

**Plan first:** improve JSON-to-CSV and JSON Lines workflows alongside the
existing CSV-to-JSON tool: local bounded file import with safe cancellation,
clear input retention on read failure, same-file reimport, format-specific
JSON/JSONL downloads, optional CSV header and pipe delimiter. Preserve existing
conversion defaults, bounds, numeric fidelity warnings, privacy and full-width
workspace. File contents never go in URLs or leave the browser. Protect against
stale async reads and outputs, and keep errors out of downloadable results.

**Evidence and limits:** OWASP explains spreadsheet formula injection and notes
that no universal CSV sanitization works for all spreadsheet apps and consumers:
https://owasp.org/www-community/attacks/CSV_Injection . Quoting is not a safety
mechanism. Do not promise that files are safe for spreadsheets or silently
change user data; preserve the explicit warning. Feature evidence is not measured
search demand. Validate file limits, malformed input, options, actual downloads,
races, keyboard/mobile and axe; run full tests, audit, CI and Vercel preview.
Use one consolidated PR and release only after verification.

**Implemented:** JSON-to-CSV and JSONL accept bounded local UTF-8 imports,
reject invalid UTF-8, preserve prior input on failure and discard superseded
reads. JSON-to-CSV adds pipe delimiter and optional header with unchanged
defaults and preserves single-column empty records as quoted empty fields; JSONL downloads use .json/.jsonl matching conversion direction.
Local engine/DOM, full Chromium downloads, narrow-screen axe, and audit pass.
Real devices, other browsers, assistive technology and spreadsheet-specific
formula handling remain unverified. CI, preview and production checks are gates.

---

## PDF numbering customization batch — 2026-10-31

Plan: extend the existing local page-numbering workflow, not a duplicate tool:
provide six visible-page positions, bounded font size, black/white contrast and
an optional unnumbered first output page (numbering starts on the next page).
Defaults preserve existing behavior. Reject invalid settings and too-small or
unsupported pages; numbers can overlap content and copied PDFs can lose
signatures, forms or bookmarks. Keep processing local and full-width. Snapshot
settings per export and invalidate stale work without cancelling document loading.
Test all position/rotation combinations via real rendered cropped PDFs, numbering
sequence, skip semantics, input limits, stale work, mobile/axe and existing tools.
Run full check, Chromium suite, audit and CI; use one PR and release only after
preview and production verification. No measured search-volume claim.

Implemented: all six positions, sizes 8–36 pt, black/white and optional
unnumbered first output page; defaults are backward-compatible. Changes during
export invalidate it; settings changes during file loading no longer discard the
load. Full check, npm audit and Chromium pass. Actual PDF.js pixel and text
checks cover six positions across four rotations/cropped mixed-size pages, size,
white text and skipped cover. Source/file fidelity beyond tested cases, other
browsers/viewers and physical/assistive-technology testing remain open.

---

## PDF numbering feasibility batch — 2026-10-31

Plan first: explore optional local numbering in the existing organizer, not a
redundant tool page. Default remains unchanged. Use output order and configurable
starting number; use the visible crop box and final quarter-turn for positioning.
Reject unsupported/small page geometries and do not claim signatures, forms,
bookmarks or fidelity are preserved. Invalidate running exports when settings
change. Verify real rendered output on differently sized, rotated and cropped
pages, exported text/sequence, invalid input, source preservation, mobile and
accessibility. Run full checks and browser suite; only merge and deploy verified
scope in one consolidated PR. If render/fidelity tests fail, defer release.

Implemented optional black bottom-centre numbering with a bounded starting
number; original output remains the default. Reordered pages use output order,
and unsupported crop boxes or too-small pages fail before download. Existing
content can be obscured, black backgrounds can hide numbers, and existing page
labels are unchanged. Full local checks, real Chromium rendering with cropped
quarter-turn pages, mobile axe, source/invalid input and stale-output tests pass.
Other viewers, devices, complex PDFs, signatures/forms and usability remain
unverified. CI/preview and production verification remain release gates.

---

## PDF organizer workflow batch — 2026-10-31

**Plan:** improve the existing local PDF organizer rather than publish an
untested page-number stamping tool. Let users quickly keep original page ranges
and reverse the current selection, with explicit ordering and restoration
semantics. Preserve manual rotation/order where applicable, prevent stale exports,
provide clear validation and keyboard-accessible controls, and document that page
ranges refer to original pages. Empty or invalid selections must not destroy work.
Keep existing 500-page bound, full-width layout and no-upload model. Test real PDF
output, selection/order, invalid ranges, reset, mobile/axe and existing behavior;
run full checks, Chromium suite and audit. One consolidated PR; release only
after CI and production verification. Competitor workflows are inspiration, not
measured demand. PDF stamping and current-year tax work remain deferred pending
fidelity and primary-source verification.

**Implemented:** range, odd/even and reverse controls operate on the current
selection, preserving existing rotations; invalid or empty filters leave it
unchanged. Restoring is required to recover removed pages. Documentation and
real-PDF tests cover filters, reverse, invalid input, rotation preservation,
stale export invalidation and mobile axe. Local full check, Chromium suite and
npm audit pass; device/browser diversity and actual user testing remain open.

---

## UX and discovery batch — research and plan (2026-10-31)

**Goal:** make finding and completing a tool task clearer on mobile and desktop,
without reducing tool workspace width, compromising local processing or copying
competitors' branding. One consolidated PR; measure task outcomes rather than
claiming rankings or market volume.

**Evidence:** iLoveIMG and iLovePDF organize tasks by clear categories and
specific action-oriented tool names (https://www.iloveimg.com/ and
https://www.ilovepdf.com/); Smallpdf surfaces common workflows prominently
(https://smallpdf.com/). Those feature listings are not proof of demand or
search volume. NN/g recommends keeping frequently needed actions visible and
only disclosing secondary options (https://www.nngroup.com/articles/progressive-disclosure/).
Google recommends a clear main content area and a good mobile page experience,
not an SEO ranking guarantee (https://developers.google.com/search/docs/appearance/page-experience).
The supplied GSC data is site-specific and its dates are inconsistent with this
session's date; do not use it to assert current market demand.

**Observed opportunities:** tool-page search disappears entirely on mobile;
homepage cards hide descriptive text on small screens; homepage search results
lack explicit expanded/active-result feedback for assistive technology; hero
puts badges ahead of the actual task. Improve these first, with clear direct
access to existing image/PDF/calculator tools rather than inventing features.

**Implementation and release gates:** preserve static/crawlable links and full
workspace width; support keyboard and screen readers, narrow screens, long text,
light/dark, reduced motion, no-JS fallback, and existing local privacy promises.
Test actual search/navigation, focus, mobile and desktop layout, axe, all tools'
mounts and widths; run build/integrity, real-browser tests and audit. Document
remaining gaps; use one PR and release only after CI and preview succeed.
No user testing or field Core Web Vitals data is available yet.

**Implemented in this batch:** task-first homepage with four direct, static tool
links, compact responsive layout, visible mobile card descriptions, and honest
limits copy. Added mobile header search with a no-JS browse fallback; search now
reports results, supports arrow-key selection and Escape, handles failed index
loading, and guards against stale async results. No changes to calculation or file
processing behavior. Full local build/integrity and Chromium coverage run across
132 tool widths; search tests include keyboard, no-JS fallback and axe in both
themes. User/device/assistive-technology testing and field performance remain
outstanding. CI, preview and production verification are release gates.

---

## Market research and next consolidated plan — 2026-10-31

### Evidence and limits

- Current source catalogue: 132 tools, including 6 PDF and 16 image-category
  tools (categories overlap). Existing PDF-to-image, local batch resize/rotate,
  JSON tree/compare and keyword-frequency features are already implemented.
- Competitor feature pages show problems served, not demand volumes, traffic,
  difficulty or outcomes. No verified India search-volume, Google Trends export,
  competitor-traffic estimate or new GSC export was available for this research;
  do not describe the priorities below as measured high-volume rankings.
- Previous GSC export documented below is labelled 1–7 Nov 2026, later than this
  session's stated date of 31 Oct 2026. Preserve it as supplied historical
  context but do not use it as verified current evidence until dates/timezone are
  reconciled. Page and query aggregates differ; use page-filtered queries.
- Google Trends is a sampled, relative interest signal, not absolute search
  volume: https://support.google.com/trends/answer/4365533?hl=en .
- Google recommends helpful, accurate, people-first content rather than pages
  made mainly for rankings: https://developers.google.com/search/docs/fundamentals/creating-helpful-content .

### Competitor gaps and opportunity hypotheses

1. **PDF workflows — high priority, demand unquantified.** iLovePDF documents
   merge, split, compression, PDF-to-JPG, numbering and watermark workflows:
   https://www.ilovepdf.com/help/documentation and
   https://www.ilovepdf.com/pricing . PDF24 lists numbering, watermark and OCR:
   https://www.pdf24.org/en/ . We already have merge, split, organizer, rotate,
   image-to-PDF and page-to-image; we do not have page-number stamping, PDF
   compression or OCR. Prioritize page numbering using existing local pdf-lib;
   preview, rotated pages, mixed sizes, page ranges, encryption, forms and digital
   signatures require explicit verification. Do not promise document fidelity.
2. **Image workflow — high priority, demand unquantified.** iLoveIMG advertises
   image/text watermark, opacity and batch operations:
   https://www.iloveimg.com/watermark-image . We already offer local bulk resize,
   compression, rotate/flip and ZIP; explore a local text-watermark option with
   preview and bounded settings, first without promising image logos, font parity,
   or irreversible protection. Compare whether it belongs in the existing batch
   workflow or a genuinely distinct page after usability and test evaluation.
3. **Developer workflow — medium priority.** JSON Editor Online documents tree,
   table, search, schema validation and structured diff:
   https://jsoneditoronline.org/features/ . Our JSON tools already support local
   formatting, read-only token-preserving tree/search and structural compare;
   schema validation is a later feasibility spike, not a guaranteed deliverable.
   Reject unsafe numeric coercion, untrusted remote schema references and eval;
   do not introduce hosted sharing of private JSON by default.
4. **India calculator trust — urgent correctness work before expansion.** Our
   income-tax tool explicitly covers historical FY 2025–26; keep that label.
   The Income Tax Department says Tax Year 2026–27 uses the Income Tax Act,
   2025: https://www.incometax.gov.in/iec/foportal/latest-news?mobile-app=1&page=%2C4 .
   Audit exact current official slabs, deductions, rebate, surcharge, cess and
   edge cases before offering current-year estimates. Groww shows step-up SIP
   as a separate workflow: https://groww.in/calculators/step-up-sip-calculator .
   Explore an optional annual step-up in the existing SIP calculator, with clear
   timing, rate, zero-return, risk, rounding and no-guaranteed-return assumptions.
   Review any unsupported historical-return claims; do not infer rates from
   competitor pages or present estimates as financial/tax advice.
5. **SEO and measurement — parallel to product work.** Improve existing pages
   only where it makes the tool clearer, more useful or easier to navigate. Avoid
   duplicate doorway pages and generic mass-produced claims. Request the GSC
   Indexing → Pages report when convenient; sitemap URLs are not indexed counts.
   Compare two equal 14-day windows after the data is available, with date,
   search type, country/device and page filters recorded. Track clicks and
   impressions first, CTR/position with sample-size caveats; never equate page
   impressions with query impressions or promise ranking changes.

### Consolidated batch — release scope and remaining work

- GSC validation export supplied by the user lists 55 pending URLs (49 tools,
  five categories, homepage). The export timestamps are inconsistent with the
  session date; treat as a dated snapshot, not a current indexing verdict. All
  55 are in the locally generated sitemap and their local HTML has no noindex;
  live robots.txt permits crawling. These checks do not prove crawl or indexing.
  Use GSC URL Inspection for representative URLs and await validation; don't
  request mass indexing or change canonical URLs without an identified fault.
- Income Tax Department AY 2026–27 guidance lists the FY 2025–26 slabs:
  https://www.incometax.gov.in/iec/foportal/help/individual/return-applicable-1 .
  Slab thresholds and rates match the calculator for resident individuals, but
  this is not a complete legal audit of rebates, relief, deductions and edge
  cases. Added more explicit input limitations and stale-output invalidation;
  do not relabel as current-year tax or treat estimates as filing advice.

- Implemented annual SIP step-up, with zero as the backwards-compatible default,
  deposits increasing after each 12 months, shared state, and stale results cleared.
  Unit, DOM and Chromium tests include a 30-month zero-return example (₹32,460).
- Added optional batch image text watermark with first-successful-output preview,
  five positions, opacity, color and relative size. Chromium tests inspect ZIP
  pixels for all positions, PNG transparency and JPEG, plus invalidation and axe.
  Other browsers, complex scripts and device limits remain unverified.
- PDF page-number stamping remains unimplemented: crop/rotation, fidelity and
  cancellation still need dedicated work and real-file tests.
- Historical tax calculator remains labelled FY 2025–26; a full primary-source
  audit of all edge cases and any current-year implementation are outstanding.
- Vendor security: GitHub advisory GHSA-px8p-9vwx-vf98 affects fflate 0.8.2
  unzipSync on malformed ZIP64; production only uses zipSync, while tests unzip
  our own generated ZIPs. Updated local fflate to 0.8.3. PDF.js 6.5.438 and
  pdf-lib 1.17.1 returned no matching npm GitHub advisories during this review;
  vendored code is not covered by npm audit and needs ongoing monitoring.
- The supportable release subset is SIP step-up, image text watermark, tax UI
  safeguards and the fflate security update. PDF numbering and full tax legal
  audit are deferred, not shipped. Run checks, CI and preview before merging;
  verify production after deployment.

### Next single consolidated implementation batch

- Plan and implement bounded local PDF page-numbering if safe and practical;
  test original vs exported pages, numbering positions with rotated/cropped and
  differently sized pages, unsupported/encrypted files, stale operations and
  signature/forms/bookmark caveats. If accuracy cannot be established, defer it.
- Evaluate text watermark for the existing bulk image queue; only ship if actual
  PNG/JPEG output, transparency, position, scaling, limits, cancellation and
  accessibility can be tested. Failed items must remain visible; avoid claims
  that watermarks protect ownership or prevent copying.
- Audit SIP assumptions and current income-tax page against primary sources;
  implement only changes with independently checked expected values and clearly
  stated scope, retaining the historical tax calculator if new rules are unproven.
- Run engine, DOM, full real-browser export tests, responsive/axe checks,
  dependency audit and vendor security review. Keep runtime processing local,
  no paid services and no default uploads. One PR, CI and Vercel preview; merge
  and production verification only for the tested, supportable subset.

---

## Current batch — Batch image rotation and workflow reliability

1. Extend the existing bulk resize/compress queue to apply a common quarter-turn
   and optional output-axis mirrors before fit or padded-canvas placement.
   Keep default output unchanged; no new duplicate page or lossless JPEG claims.
2. Preserve queue ordering, partial-failure reporting, ZIP and memory limits,
   cancellation/stale-output protection, transparency and size-target behavior.
   Release canvases promptly after encoding and document operation order.
3. Test decoded ZIP pixels and dimensions for rotations, flips, white/transparent
   padding, JPEG, queue invalidation, partial failure and mobile accessibility,
   alongside full engine, browser and security checks.
4. Local checks passed: all 16 rotation/mirror combinations for two actual ZIP
   entries, padding and JPEG, partial failure, settings invalidation, pending-load
   cancellation, mobile axe, full Chromium/engine/DOM checks and npm audit.
   Other browsers, devices and complex color profiles remain unverified.
5. Use one consolidated PR and ship only after CI/preview and production verify.

---

## Current batch — Local image rotation and orientation workflow

1. Research existing rotate/flip workflows: competitors offer quarter turns,
   horizontal/vertical mirrors, output formats and often batch processing;
   feature lists are not evidence of search volume. Examples:
   https://browserimagetools.com/rotate-image/ and
   https://www.onlineimagetool.com/en/rotate-png-jpg-webp-gif
2. Add one accessible local single-image quarter-turn/mirror tool with explicit
   format controls, preview, output caps, cancellation/stale-result cleanup,
   truthful JPEG re-encoding, transparency, metadata and orientation limitations.
   Do not claim lossless JPEG or automatic EXIF repair. Batch remains future work.
3. Test exact asymmetric image pixels and dimensions for every rotation and
   mirroring combination, downloaded formats, bad/oversized inputs, mobile,
   accessibility, same-file reload and stale operations; run full checks/audit.
4. Local checks passed: all 16 rotation/mirror combinations against asymmetric
   downloaded pixels, PNG/JPEG/WebP, JPEG white background, invalid input,
   stale load/encode, responsive layouts, axe and npm audit. Browser diversity,
   physical devices and complex real-world color profiles remain unverified.
5. Ship as one PR only after CI and preview pass; verify production deployment.

---

## Current batch — Keyword and developer workflow improvements

1. Improve the existing GSC-signalled keyword frequency checker rather than
   add near-duplicate pages: support bounded custom excluded words and selectable
   result counts, with honest rules for phrase filtering and target counts.
2. Add local bounded JSON file loading on either side of structural comparison,
   with stale-read protection and no data replacement on failed import.
3. Protect existing input/import, exact target counting, density semantics,
   Unicode handling and CSV download from stale outputs; clarify limits.
4. Add engine and real-browser tests for exclusions, phrase counts, result caps,
   download contents and mobile accessibility; run all checks and audit.
5. Local checks passed: engine/DOM/integrity, full Chromium interactions at
   mobile/desktop widths, CSV download and file imports, stale-read regression,
   and npm audit. Browser/device diversity and manual accessibility remain open.
6. One consolidated PR, CI and Vercel preview before merging; verify production.
   Search Console evidence informs prioritization but does not guarantee rankings.

---

## Current batch — PDF rendering workflow and reliability

1. Extend the existing local renderer with bounded selected-page ZIP export,
   retaining single-page preview. Render sequentially, cap pages and total encoded
   bytes, abort the whole archive on error, invalidate stale work and give a
   cancel control; never imply original image extraction or guaranteed fidelity.
2. Audit PDF renderer race/error paths and user-facing limits; preserve privacy,
   zero-cost local operation, and clear handling of encrypted or oversized files.
3. Test actual ZIP entries and pixels, limits, invalid ranges, cancellation and
   re-selection, plus mobile/accessibility and full existing regression suites.
4. Local verification: full `npm run check`, npm audit and Chromium suite passed;
   real ZIP entries, PNG content pixels, JPEG output, page limits, cancellation,
   oversized-page failures and accessibility were exercised. ZIP byte-cap,
   other browsers, complex documents and physical devices need broader testing.
5. Release the ZIP workflow after CI and Vercel preview pass, then verify
   production. Prior PR #53 contains only the single-page renderer.

---

## Current batch — Local PDF page to image

1. Evaluate and locally bundle a patched PDF.js renderer and worker with license;
   load only on the tool page, without sending PDF bytes to a service.
2. Implement one-page-at-a-time PNG/JPEG rendering with file, page and canvas
   limits, cancellation/stale-result cleanup, no password prompt, and clear
   notices about rasterization, supported browsers and rendering limitations.
3. Exercise real PDF rendering and pixel/download output, rejected files,
   same-file reload, mobile/accessibility, npm audit and full site checks.
4. Real Chromium verified PNG and JPEG downloads, output dimensions and PDF
   content pixels, canvas/file limits, invalid PDFs, clear/reload, external-request
   absence, all 131 layouts and an axe scan. `npm audit` covers npm dependencies,
   not this vendored copy; separately monitor upstream PDF.js security advisories
   and update module and worker together. Complex PDFs and other browsers still
   need wider coverage.
5. Ship as one PR only when CI and preview pass; verify production deployment.

---

## Current batch — Developer and keyword workflow improvements

1. Add a local text-file import to Keyword Density with bounded size, clear
   UTF-8 limitations, stale-read protection and no replacement on rejection.
2. Improve the HTML playground's editing ergonomics while preserving keyboard
   navigation and iframe sandbox. Add opt-in Tab indentation only.
3. Add bounded JSON tree search without changing raw numeric tokens, duplicate
   keys, HTML safety or the existing formatter's output.
4. PDF renderer spike: npm metadata for pdfjs-dist 6.5.438 shows Apache-2.0,
   37,616,588 unpacked bytes; its minified main module is 474,284 bytes and
   worker 1,271,915 bytes before transfer compression (other assets may be
   needed). Security history and compatibility, memory, fonts, complex PDFs
   and real output needed testing; see the current PDF batch above.
5. Run engine, DOM, browser/mobile/accessibility and audit checks, and release
   as one consolidated batch with truthful limitations.

---

## Implementation progress — research-led consolidated batch

- Implemented bounded, read-only JSON tree: original numeric/string tokens and
  duplicate keys retained, 250,000 characters, 3,000 values and 64 levels;
  native disclosure controls and untrusted text rendered as text.
- Added optional combined date arithmetic with years, months, weeks and days
  applied in that order; month/year stages clamp separately. Existing single-unit
  workflow remains available.
- Removed outdated item/rate classifications from GST guidance, added 0% and
  40% arithmetic presets without implying applicability, kept historical rates
  and custom entry, and clarified CGST/SGST/IGST limitations. Official context:
  https://gstcouncil.gov.in/sites/default/files/2025-09/press_release_press_information_bureau_0.pdf
  and https://gstcouncil.gov.in/sites/default/files/2026-01/monthly_newsletter_december_2025_1_0.pdf
- Fixed stale percentage-change results on input edits; invalid robots rule
  submissions preserve the form and do not corrupt existing draft rules.
- PDF feasibility: `pdfjs-dist` npm metadata reports Apache-2.0 and roughly
  37.6 MB unpacked for 6.5.438; the production renderer/worker subset and device
  compatibility still need measurement. A historic PDF.js code execution
  vulnerability reinforces the need for current dependency/security review:
  https://github.com/mozilla/pdf.js/security/advisories/GHSA-wgrm-67xf-hhpq .
  No PDF-to-image tool or HTML editor console is shipped in this batch; defer
  until a bounded, tested, secure implementation is feasible.
- Next: verify tests/CI/preview and production; continue remaining planned
  keyword, HTML editing, PDF renderer and GSC investigation as a later batch.

---

## Market follow-up — GSC signals and competitor workflow comparison

**Evidence:** user-supplied Search Console Web export covering 2026-11-01 to
2026-11-07: 1,029 property impressions, zero clicks. Top page rows: robots.txt
252 (position 82.29), keyword density 77 (77.23), QR generator 74 (76.23),
date add 72 (55), percentage change 17 (9.29). Query row `keyword frequency
counter`: 18 impressions, position 26.17. These are observational signals,
not measured market-wide demand, nor causation or a sufficient sample for SEO
experiments. Page and query rows use different aggregations; don't attribute a
query to a page without applying a GSC page filter. Desktop 990, mobile 37,
tablet 2 impressions; mobile experience still needs testing. Sitemap processing
and Page Indexing report remain pending; don't infer indexed-page counts.

**Practical gaps, checked against competitor documentation and our code:**

1. **Robots.txt generator:** our tool already has multiple agents, presets,
   sitemap, export and a rule simulator; don't build a duplicate. Competitors
   offer simpler selection/configuration workflows; audit onboarding, generated
   defaults and warning clarity, and test real multi-agent/wildcard cases. Keep
   Google's distinction: robots controls crawling, not reliable privacy or
   de-indexing. Sources: https://www.commoninja.com/free-tools/seo/robots-txt-generator
   and https://developers.google.com/search/docs/crawling-indexing/robots/create-robots-txt
2. **Keyword density:** existing tool supports exact target, 1–3 word phrases,
   English stop words and CSV; competitor Toolnar additionally documents local
   text-file input, HTML stripping and per-length tabs. Evaluate file import
   and usability without silently fetching remote pages or pretending an
   invented target density improves ranking. Explain tokenization and phrase
   density denominator; test Unicode and CSV injection before shipping. Source:
   https://toolnar.com/tool/keyword-density
3. **Date add/subtract:** existing tool handles one unit at a time and documents
   end-of-month clamping; timeanddate supports combined years/months/weeks/days
   and documents calculation order. Evaluate combined durations within the same
   page with explicit order and leap-year, end-of-month and DST regression
   tests. Source: https://www.timeanddate.com/date/dateadd-help.html
4. **Percentage change:** 17 impressions at 9.29 are too few to infer a reliable
   ranking or diagnose CTR. Existing calculator includes formula, multiplier and
   reverse change. Verify zero/negative input examples, result invalidation and
   accessible formatting before altering the page. Compare page-filtered GSC
   queries over equal complete periods; do not stuff titles or duplicate routes.
5. **New work:** prioritize feasibility of local PDF page-to-image rendering
   over a duplicate image resizer. Explicitly distinguish rasterizing pages from
   extracting embedded images, which iLovePDF offers as separate operations.
   Budget library size, memory, rendering fidelity, licences and pixel/export
   tests; no guaranteed compression. Source:
   https://www.ilovepdf.com/blog/convert-pdf-to-jpg
6. **Developer work:** CodePen documents separate HTML/CSS/JS panels, live view
   and console; our single-document sandbox plus live full-window tab already
   covers a different core workflow. Improve editing affordances without
   weakening sandbox or promising feature parity. JSON Editor Online explicitly
   handles numeric precision; our future tree must not silently round or corrupt
   values. Sources: https://blog.codepen.io/documentation/editor-view/ and
   https://jsoneditoronline.org/indepth/parse/why-does-json-parse-corrupt-large-numbers/

**Batch order:** research-informed fixes to the four GSC-signal tools, GST
correctness audit, existing developer workflows and PDF-rendering feasibility
are one planned consolidated branch/PR. Ship only tested scope; keep local-only
processing and no paid dependencies. Measure afterwards with matched GSC date,
search type, page and country filters, focusing on impressions/clicks over
position alone. Google notes page/property aggregation may differ:
https://support.google.com/webmasters/answer/17010961?hl=en .

---

## Market research and next consolidated roadmap (2026-11-07)

**Status:** research and planning only; the following items are not shipped yet.
Catalogue baseline: 130 tools, including PDF merge/split/rotate/organizer and
image-to-PDF, bulk image resizing/compression, JSON formatting/compare and
HTML live preview. Recent workspace widening is already deployed. There is no
measured keyword volume, conversion, competitor traffic, ranking guarantee, in that initial research. A subsequent user-provided seven-day GSC export is summarized above. Competitor feature pages show use cases, not
proof of search demand or the accuracy of their pricing claims.

### Findings and prioritization

- **Developer workflow — high-confidence product gap:** JSON Editor Online
  offers tree/code/table views and search; our JSON formatter and compare do not
  yet provide a dedicated navigable tree. ToolPlanet describes an HTML/CSS/JS
  playground with console output. Assess improvements to our existing pages
  before multiplying near-duplicate pages.
- **PDF workflow — strong competitor coverage, technically heavier:** iLovePDF
  lists PDF compression and conversion alongside our existing organize/merge
  tools. We lack PDF-to-image and PDF compression. Rendering PDFs needs a
  separately evaluated renderer; pdf-lib alone is not a page renderer. Good
  compression is nontrivial and must not be marketed as lossless or guaranteed.
- **Image workflow — extend what exists:** iLoveIMG documents batch previews,
  size changes and crop workflows. Our bulk resizer/compressor already provides
  batch conversion, contain canvas, target size and ZIP, so do not re-create it.
  Assess measurable queue usability and export clarity before adding features.
- **India calculator trust — correctness first:** GST Council's 56th meeting
  materials recommend changes including 5%, 18% and 40% rates with exceptions;
  this is not sufficient to classify every product/service. Audit our existing
  GST presets, explanatory text and dated tax calculator against applicable
  official notifications before claiming current coverage. Never infer a rate
  from product name or claim compliance-ready advice without verification.
- **SEO — optimize useful workflows, not page count:** Google's Search
  Essentials prioritizes people-first content and crawlable links. Avoid thin
  duplicate pages or invented search-volume data. GSC Page Indexing screenshot
  and the >=14-day comparison around 17 Nov remain outstanding, but do not block
  product work.

### Proposed next batch — one branch, one PR

1. **Reliability and trusted financial information:** audit the current GST and
   historic income-tax wording, controls and examples against primary sources;
   correct demonstrable problems only, retain explicit date and limits, test
   inclusive/exclusive math and avoid suggesting all supply rates are covered.
2. **Developer experience:** improve existing JSON formatter with a bounded,
   accessible expandable tree/search if a lossless implementation can preserve
   original numeric tokens and reject unsafe or deeply nested inputs. If that
   cannot be ensured, show a clear limitation and do not silently round numbers.
   Audit HTML playground for practical editing features (e.g. keyboard Tab
   indentation and clearer errors), preserving its opaque-origin sandbox and
   explaining that external requests remain possible; no remote execution or
   shared source URLs. Scope console support only if safe and robust.
3. **PDF feasibility spike:** evaluate a maintained, locally bundled renderer,
   license, package size, memory, password handling and mobile performance.
   If feasible, implement a bounded local PDF-to-image workflow with page
   selection, transparent failure handling and tested exported pixels; otherwise
   document the blocker rather than shipping an unreliable converter. Do not
   promise compression, OCR, PDF editing, or high fidelity to unsupported PDFs.
4. **Cross-tool usability:** preserve full-width workspace on all tools, check
   keyboard/mobile layouts, progress, limits, cancellation and stale results;
   keep privacy statements specific and retain user code only with explicit
   behavior. No secrets in URLs and no paid services required.
5. **Release gate:** engine/DOM/integrity, real Chromium interactions and exports,
   mobile overflow and accessibility, dependency audit, CI and Vercel preview;
   one consolidated PR, then production deployment verification. Document
   remaining browser/device/file and financial limitations honestly.

### Later, conditional on evidence

- PDF compression and OCR: only after a separate fidelity, memory, dependency,
  security and zero-cost feasibility study with representative files.
- Background removal: possible future research, but local AI model download,
  browser memory, licensing and segmentation quality make it a separate project;
  no unsupported claim of AI/background removal now.
- When GSC data is available, compare equal date windows, queries/pages/countries,
  clicks and impressions; use low-volume data cautiously and check Indexing →
  Pages before changing priorities. No paywall, custom domain or billing needed.

### Research sources (accessed 2026-11-07)

- https://jsoneditoronline.org/features/ — two panels, tree/code/table, search/transform.
- https://toolplanet.dev/tools — examples of JSON and live playground workflows.
- https://www.ilovepdf.com/pricing — PDF feature categories and batch offerings;
  limits/prices can change and are not independently certified.
- https://www.iloveimg.com/help/documentation — image previews, resize and crop.
- https://gstcouncil.gov.in/sites/default/files/2025-09/press_release_press_information_bureau_0.pdf
  and https://gstcouncil.gov.in/sites/default/files/2026-01/monthly_newsletter_december_2025_1_0.pdf
  — official rate-change context; check current notified rates before changes.
- https://developers.google.com/search/docs/essentials and
  https://developers.google.com/search/docs/monitor-debug/search-console-start
  — people-first guidance and GSC reporting.

---

## Current batch — More usable workspace for every tool (2026-11-07)

1. Remove the narrow shared tool workspace cap on desktop while retaining
   comfortable gutters and readable documentation; apply consistently across
   all tool pages, not only the HTML editor.
2. Give the HTML editor and preview larger responsive panes; preserve stacked
   mobile layouts, controls and sandbox behavior. Remove the stray `null` text.
3. Test every registered tool for workspace sizing and overflow on desktop and
   mobile, plus representative interactions and accessibility; run the full
   checks, release in one PR and verify the production deployment.

---

## Current batch — Live HTML playground (2026-11-07)

1. Build a developer-facing HTML editor with live HTML/CSS/JavaScript preview,
   manual run, stop, reset and responsive layout. Never inject user code into
   the site's own DOM: use a scripts-only opaque-origin sandboxed iframe.
2. Add a full-window preview in a new tab, live-synchronized from the editor
   using an ephemeral random same-origin channel; never put code in a URL or
   storage. Gracefully explain browsers without channel support.
3. Document network, iframe restrictions, unsaved work and runaway-script
   limitations; no claim the sandbox is a complete security boundary.
4. Add unit/DOM and real-browser tests for live updates, JS, sandbox isolation,
   new-tab synchronization, pause/stop/reset, limits, mobile and accessibility;
   run checks/audit and release in one PR after CI/preview and production verify.

---

## Launch-critical stabilization pass (2026-11-07)

**Scope and stop condition:** The site is already live. This pass prioritizes
user-visible correctness, privacy and broken core workflows over additional
features. Complete a single consolidated release after local checks, browser
regressions, CI and production verification. Findings that require physical
hardware, external indexing data, legal interpretation or extensive fixture
matrices are documented rather than represented as complete. Optional feature
polish is deferred; this is not a guarantee of ranking or universal correctness.

1. Audit shared download handling, external thumbnail workflows, and
   high-traffic financial labels for stale or misleading results.
2. Fix confirmed issues and add regression tests for blocked downloads, async
   races, user-visible failures, and outdated-period/tie clarity.
3. Run the entire engine/DOM/integrity suite, security audit and real Chromium
   including full initial-state accessibility scans where environment permits.
4. Release one PR, verify preview and production, and report outstanding
   physical-device/browser/GSC and real-world file gaps without overstating.

Initial rough estimate to user: 3–6 active working hours for the targeted pass
if no new critical issues arise; full deep certification takes longer and needs
real devices. SEO impact cannot be promised on a schedule. Estimate is not an
SLA and depends on CI/deployment and what the audit uncovers.

---

## Current consolidated batch — QR and imported-data safety (2026-11-07)

1. Audit QR generation, image scanning and camera lifecycle alongside CSV file
   import, focusing on rejected input, races, stale results and download errors.
2. Stop camera and invalidate pending scans on all rejected selections; support
   same-file reselection, honest PNG/SVG download status and generator cleanup.
   Protect CSV imports from late reads and rejected-file ambiguity.
3. Exercise generated PNG/SVG and scanner end-to-end in Chromium, camera mocks,
   oversized selections, stale/failed downloads, mobile and automated axe checks.
4. Update guidance and audit; run full checks, security audit and review, then
   ship one consolidated PR only after CI/preview pass and verify production.
   No claim of protection from phishing or physical-camera certification.

---

## Current consolidated batch — image editing integrity and crop accessibility (2026-11-07)

1. Audit single-image compressor, resizer, converter, cropper and metadata viewer
   for stale results, oversized selection rejection, async races and reselection.
2. Clear stale previews and pending work; add a keyboard-operable pixel-coordinate
   crop workflow alongside pointer selection, with explicit bounds validation.
3. Test actual crop pixels, coordinates, mobile/axe, same-file reload, invalid
   inputs and race/rejection behavior; document limits and privacy honestly.
4. Run checks and dependency audit, review the changes and deliver one PR only
   after CI and preview pass, then verify production. No ranking guarantees.

---

## Current consolidated batch — audio and media workflow integrity (2026-11-07)

1. Audit audio and MP4 selection, async decoding, playback lifecycle and WAV
   download handling; compare claims and actual supported resource limits.
2. Invalidate stale media after rejected selections or page exit, permit
   same-file reselection, manage trimmer playback cleanup, and report download
   failures without claiming a successful save.
3. Add race, oversized rejection, playback and download regressions; verify
   actual WAV and MP4 paths in Chromium and update user-facing limitations.
4. Run full checks and dependency audit, review and deliver one consolidated
   PR after CI and preview, then verify production. Browser codecs, physical
   audio hardware and accessibility remain outside automated certification.

---

## Current consolidated batch — PDF workflow integrity (2026-11-07)

1. Audit PDF organizer, merge, split, rotate and image-to-PDF selection,
   settings, asynchronous operations and oversized-file rejection.
2. Prevent outdated downloads after settings edits or rejected input; make
   selection semantics and same-file reselection explicit, and stop obsolete
   work between asynchronous steps where possible.
3. Test race conditions, same-file selection, rejection, page ordering,
   downloadable output, mobile layout and accessibility; document limits of
   page copying and browser download behavior without claiming certification.
4. Run full checks and dependency audit, review and ship one consolidated PR;
   verify CI, Vercel preview and production.

---

## Current batch — bulk image queue and export integrity (2026-11-07)

1. Research batch file naming and audit queue, filename portability, cancellation
   and stale-output behavior; keep improvements on the existing workflow.
2. Add a manageable queue with remove, move and clear controls, safe optional
   naming prefix and live output-name preview. Keep ZIP names unique and bounded
   in UTF-8 bytes; invalidate all stale or pending output on every queue edit.
3. Exercise duplicates, invalid names, Unicode, limits, same-file reselection,
   reorder/remove races, real ZIP filenames, mobile layout and accessibility.
4. Document limits, run full checks and audit, review diff and release one PR
   only after CI/preview pass; confirm production. Feature research does not
   establish keyword volume or guarantee ranking.

---

## Current batch — fixed-canvas batch image workflow (2026-11-07)

1. Research actual batch resize/padding workflows; extend the existing bulk tool
   rather than duplicate pages or imply marketplace compliance.
2. Add an exact-width/height padded canvas with centered, uncropped image,
   white or transparent padding, explicit enlargement rules and format limits.
   Retain existing fit and per-file byte-target modes and clear stale results.
3. Fix rejected oversized selections retaining previous batch output; test geometry,
   transparency and colors from actual ZIPs, accessibility, validation and races.
4. Document the limits and run build, full checks, audit and browser CI; release
   one PR after checks and Vercel preview, then verify production.

---

## Current batch — per-image target size (2026-11-07)

1. Research target-size workflows and browser canvas encoder limits; implement
   a bounded JPEG/WebP per-file search in the existing bulk tool, not a doorway.
2. Never claim a target was met without checking actual bytes; fail individual
   files when no sampled quality meets it. Preserve cancellation, limits and ZIP
   semantics; clearly disclose fixed dimensions, quality loss and PNG limitation.
3. Add deterministic adversarial encoder tests, UI race/validation tests, and
   real-browser ZIP/byte-size and impossible-target regressions; update guides.
4. Run full checks and audit, inspect the diff, ship one PR after CI/preview,
   and verify production. Market feature examples are not keyword-volume proof.

---

## Current consolidated batch — bulk image compression workflow (2026-11-07)

1. Research competitor batch compression workflows and inspect the existing bulk
   resizer; strengthen the existing page rather than create a duplicate doorway.
2. Support keeping original dimensions, report honest before/after sizes and
   increases per file, and preserve resource, privacy and stale-output safeguards.
3. Improve search intent, contextual guidance and discovery; test proportional
   bounds, original dimensions, failures, ZIP contents, mobile and accessibility.
4. Audit outcomes and limitations, run checks and security audit; ship one PR
   after CI and preview pass and verify production. No ranking claims.

---

## Current consolidated batch — bulk image resizing (2026-11-07)

1. Competitor feature research identifies a batch image resizing + ZIP workflow;
   this is feature evidence, not verified keyword volume or a ranking guarantee.
2. Build a real client-side bulk image resizer with proportional fit, clear size
   and batch limits, per-file failures, unique safe archive names, ZIP download,
   cancellation/invalidation, and transparent output-format limitations.
3. Add search/discovery, useful static guidance, links, independent ZIP and
   browser output tests plus mobile/accessibility and edge-case regressions.
4. Run full checks and dependency audit; release one consolidated PR after CI and
   preview pass, verify production, and document remaining limitations.

---

## Current consolidated plan — image metadata trust and privacy (2026-11-07)

1. Research real user needs in private image workflows and review the existing
   metadata viewer for misleading absence, GPS precision and malformed EXIF handling.
2. Fix confirmed issues and communicate format/coverage limits clearly: this is
   a partial inspection, not proof that a file is safe to share or metadata-free.
3. Stop automatically advancing unchanged trust-page dates on each build; use
   only maintained modification dates and add build/integrity regression checks.
4. Add independent synthetic EXIF fixtures and UI regression tests, including
   malformed data, GPS precision, and JPEG marker boundaries; run all checks.
5. Review changes, security audit, and release via one PR after CI and preview
   pass; verify production. Record what is and is not tested in TOOL-AUDIT.md.

---

## Consolidated browser verification and remaining reliability plan (2026-11-06)

1. Try to unblock headless Chromium using only permitted, free sources; document
   dependencies and failures instead of calling jsdom a real-browser test.
2. If available, exercise all 128 routes in a real browser, plus representative
   calculations, download payloads, offline/privacy behavior, mobile layout and
   accessibility. Fix reproducible high-priority problems together with tests.
3. Independently recheck SEO/deployment, automated engine/DOM/security suites,
   build outputs and known risky file workflows. Clearly document what has and
   has not actually been tested, including device and format limitations.
4. Update audit evidence, ship this as one consolidated PR only after checks pass,
   verify the Vercel production deployment and report honestly. Do not claim
   exhaustive 128-tool certification or ranking guarantees.

---

## Consolidated remaining audit — one branch, one PR (2026-11-06)

**User direction:** stop opening a PR for each small category. Keep remaining
work consolidated. The user requested a PR for the current in-progress changes;
further work can continue on this branch while that PR remains open. Prior batch
plans below are history, not a reason to create another PR for each category.
Do not claim that the 128-tool audit is certified merely because smoke tests pass.

1. Inventory unresolved accuracy, input-validation, stale-result and resource
   risks across converters, text/data, developer/security, finance/student,
   date/time, color, SEO, random and media/PDF families. Prioritize silent data
   loss, wrong calculations and unsafe outputs; fix confirmed defects together.
2. Expand automated independent-reference and boundary tests across families;
   cover UI invalidation and asynchronous race cases. Test real files, outputs
   and actual browser APIs where this environment supports them; explicitly log
   which browsers/devices, file types and accessibility checks remain unverified.
3. Review cross-cutting privacy, accessibility, offline behavior, metadata,
   internal links and site performance claims. Research current official guidance
   where relevant; do not promise search rankings or treat GSC impressions alone
   as success. Avoid new paid services.
4. Update TOOL-AUDIT.md with evidence and limitations, run full build/check,
   dependency audit and diff review. The user requested release: after CI and
   preview pass, merge this consolidated PR once and verify production. Do not
   imply that unavailable real-device tests or the entire audit are complete.

---

## Batch 28 plan — student and math calculator accuracy

1. Audit scientific calculator mode/parser, fractions, duration, attendance and
   credit-weighted GPA, including invalid and boundary inputs.
2. Fix wrong default angle, scientific-notation reuse, bounds, attendance rounding,
   silent fractional inputs, incomplete GPA rows and stale result displays.
3. Add independent numeric references and UI regressions, including near-boundary
   attendance, exact grading inputs, clock-style durations and calculator modes.
4. Document limitations, rebuild, run full checks and dependency audit, then one
   CI-verified PR and production verification. Financial/educational results remain
   estimates governed by the user's institution.

---

## Batch 27 plan — interactive random and typing tools

1. Audit random number/dice input validation, unbiased sampling, display and stale
   output; avoid unbounded retries for unique draws.
2. Fix spin-wheel list changes during animation, winner invalidation and entry
   limits. Preserve duplicate entries as separate weighted choices and explain it.
3. Fix typing duration selection and deadline handling; use a monotonic clock,
   reset sessions consistently and make scoring/paste limitations honest.
4. Add deterministic engine and interaction regressions, update audit, run full
   checks/security audit, then one CI-verified PR and production verification.

---

## Batch 26 plan — QR generation, scanner and camera lifecycle

1. Audit exact QR payload preservation, library loading and asynchronous generator
   state; invalidate outputs and pending downloads on edits or newer requests.
2. Isolate scanner file/camera sessions with generation tokens, cancel pending
   permission requests safely, stop stale streams and clean up URLs on page exit.
3. Enforce practical upload limits, preserve safe link classification and disclose
   processing/resource limitations. Cover failures and race conditions using mocked
   browser APIs alongside real encoder/decoder round trips.
4. Update audit, run full checks and dependency audit, then one PR with CI and
   production verification. Physical camera and real-browser tests remain pending.

---

## Batch 25 plan — SEO generator output integrity

1. Audit robots.txt, sitemap, meta and URL parsing workflows against published
   crawler/sitemap rules; validate generated directives and absolute URLs.
2. Prevent malformed or injected directives and XML, guard sitemap limits,
   correct misleading URL/domain labels and remove stale downloadable outputs.
3. Bound potentially costly matching and keyword tasks; disclose simulator and
   search-engine limitations instead of implying guaranteed indexing behavior.
4. Add independent edge-case and DOM regression tests, update the audit, run full
   checks and dependency audit, then one PR and production deployment verification.

---

## Batch 24 plan — text tools integrity

1. Audit text counts, Unicode slugs, line deduplication/sorting, diff limits and
   change detection, and their UI disclosures for actual behaviour.
2. Repair destructive transformations, inconsistent empty counts, numerical
   sorting and stale output; bound costly diff inputs and preserve terminal lines.
3. Add engine and DOM regressions for Unicode, empty/blank lines, ordering,
   large asymmetric inputs, terminal newlines and output invalidation.
4. Rebuild, run full checks and dependency audit, update audit with remaining
   heuristic and browser limitations, ship one PR after CI and verify deployment.

---

## Batch 23 plan — safe regex execution and output integrity

1. Move user-supplied regex evaluation into a terminable local Web Worker; cancel
   obsolete jobs immediately, enforce a time limit, and fail closed if unavailable.
2. Bound inputs and rendered match/group data, accurately disclose truncation,
   preserve zero-width matches and Unicode text, and expose named groups.
3. Add engine, worker-thread and DOM regressions for cancellation, timeout,
   stale output, malformed patterns, caps, and highlight fidelity; update audit.
4. Run full checks and dependency audit, then one PR, CI and production verification.
   Real-browser performance and compatibility remain a separate manual task.

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

## ✅ BATCH-10 — Everyday money and small-business planning (2026-11-06)

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
PR #16 merged; CI passed and Vercel production READY/PROMOTED.

---

## ✅ BATCH-11 — Privacy-first sharing and trust audit (2026-11-06)

OWASP and CWE-598 document query parameters leaking to logs and browser history;
this matters for financial and health calculators. Current automatic URL sync
and broad "never stored" statements are inconsistent. Fix the whole workflow,
not just the four newest tools. Preserve legacy shared-query links without
claiming client-side cleanup can undo requests already made.

One complete batch:
1. Stop automatically placing calculator inputs in the address bar. Make the
   header Copy link copy a clean tool URL. Offer an explicit calculator action
   to generate/copy a link with inputs in a URL fragment, with an accessible
   manual-copy fallback and a warning that links/history/clipboard are not
   private. Fragments are not sent in HTTP requests, but are not secret.
2. Parse legacy query links and new fragment links; scrub recognised legacy
   query inputs from the address bar after reading while preserving unrelated
   parameters and page anchors. No promise to erase prior hosting logs/history.
3. Audit generated privacy/FAQ/about/README text and storage disclosures,
   including favourites/recent lists, Vercel hosting and request logging. Do not
   claim all inputs can never leave a device. Keep file-processing claims scoped.
4. Test all shareState clients, privacy warnings, query compatibility, safe
   links, clipboard failure, stale outputs, caching and static consistency.
   Regenerate, run full checks, one PR, CI and production verification. Real
   browser, accessibility/device and Lighthouse checks remain separate.

Implemented: opt-in fragment sharing across 36 calculator interfaces; clean
page-link copy; legacy compatibility and disclosure; Vercel and YouTube CDN
privacy corrections; v4 worker refresh and JS revalidation. Local checks pass:
190 engine, 81 DOM, 9 chrome, service worker and 20 integrity. PR #17
merged; production READY/PROMOTED and live privacy pages verified.

---

## ✅ BATCH-12 — Math & statistics reliability (2026-11-06)

Market scan of public calculator directories shows average/statistics, ratios,
and weighted averages as common workflows (qualitative only, not search-volume
proof). We already have average and ratio pages: improve those instead of
creating thin duplicate statistics/ratio pages. Audit found ratio solving builds
rows but never displays them; floating-point GCD gives misleading decimals;
mode ignores ties; unbounded prime factoring risks locking the browser.

One planned batch:
1. Upgrade Average Calculator with tied modes, sample and population variance
   and standard deviation, bounded inputs and documented numeric limitations.
2. Repair Ratio Calculator's actual proportion result and decimal simplification
   using exact scaled integer arithmetic; clearly define accepted inputs.
3. Bound GCD/LCM inputs and factorisation, detect unsafe LCM overflow and clear
   stale results on errors; explicitly state limits rather than silently round.
4. Add distinct Weighted Average Calculator (value/weight pairs, non-negative
   weights), original examples, guides and FAQs for all four math workflows,
   useful related links and no duplicate pages. Add pure and UI tests covering
   ties, singleton, decimal boundaries, errors, overflow, and stale results.
5. Build generated pages, run full checks, one PR, CI and production verification.
   GSC measurement and real-browser/device audits remain separate pending tasks.

Implementation complete locally: 123 tools / 66 guides; four math guides,
weighted-average tool, tied modes and sample/population spread, exact decimal
ratio simplification, visible proportion output and bounded integer factoring.
Local checks: 195 engine, 85 DOM, 9 chrome, worker suite and 20 integrity.
PR #18 merged; production READY/PROMOTED and live pages verified.

---

## ✅ BATCH-13 — Calendar and date reliability (2026-11-06)

Market scan shows age, deadline and ISO-week workflows; this is qualitative,
not search-volume evidence. Existing age and date-difference pages can produce
negative day components at month ends, age totals use local elapsed milliseconds
across DST, and leap-day birthdays silently roll to March. Improve those pages
rather than publishing duplicate age/countdown pages.

One planned batch:
1. Share strict, bounded Gregorian calendar-date arithmetic with timezone-safe
   day counts and explicit month-end rules. Fix age breakdown, birthday display,
   and selectable February 29 convention without claiming legal eligibility.
2. Repair Date Difference month-end/inclusive explanations and Date Add input
   validation, non-integer handling and local-date defaults, preserving historical
   share links and disclosing that date-derived hours are not elapsed time.
3. Add a distinct ISO Week Number Calculator with ISO week-year, Monday/Sunday
   dates and accurate year-boundary handling; guides, FAQs and related links.
4. Engine and DOM tests for leap dates, DST zones, boundaries, inclusive/reverse
   counts, malformed input, legacy sharing, plus generated pages and docs.
   Time Zone Converter rejects nonexistent and ambiguous wall times rather than
   silently selecting an instant, and defaults to the local calendar date. Full
   check, one PR, CI and production verification; GSC and real-device tests remain
   separate pending tasks.

Implemented: 124 tools / 70 guides; explicit leap-day choices, date-only UTC
arithmetic, ISO weeks, stricter date-add validation, and DST gap/overlap errors.
Full local check: 202 engine, 90 DOM, 9 chrome, worker suite and 20 integrity.
PR #19 merged, CI passed, Vercel production READY/PROMOTED; ISO week, age and time-zone pages verified live.

---

## ✅ BATCH-14 — Reliable conversion workflows (2026-11-06)

Market scan (Measurement Wizard, Toolonic and Baseutils) shows pressure,
energy, power and fuel-economy workflows beyond our existing eight converter
families; this is qualitative evidence, not verified search demand. NIST SP 811
Appendix B (https://www.nist.gov/pml/special-publication-811/nist-guide-si-appendix-b-conversion-factors) supplies reference conversion factors and explains reciprocal MPG to
L/100 km. First improve existing converter safety and output rather than create
thin pages for each unit pair.

One batch, one PR:
1. Audit shared converter errors/precision and fix non-finite output, invalid
   unit/set handling and tiny values rounded to zero in tables. Explain numeric
   rounding, temperature absolute-zero limit and time averages honestly.
2. Add pressure, energy and power converters with unambiguous units (US/metric
   horsepower, thermochemical calories) and a distinct reciprocal fuel-economy
   converter supporting US/UK mpg, km/L and L/100 km; positive finite inputs,
   explicitly explain US vs UK gallon and reciprocal direction.
3. Original worked examples, FAQ, internal links, search metadata; improve
   existing volume/time/speed/temperature guides where missing, and do not
   imply volume-to-weight conversion without ingredient density.
4. Regression tests: factor references, round trips, small/large numbers,
   malformed values, reciprocity and zero, stale UI state, swap and discoverability.
   Also update vulnerable build/test-only dependencies and run service-worker
   checks in CI. Full build/check, CI, one PR, production verify. Real-browser audits and GSC
   measurement remain pending; no paid services.

Local implementation complete: 128 tools / 78 guides; 206 engine, 93 DOM,
9 chrome, service-worker and 20 integrity checks passed; npm audit reports zero
vulnerabilities. PR #20 merged, CI passed, production READY/PROMOTED; live converter examples verified.

---

## 🚧 BATCH-15 — A-to-Z real-tools audit (2026-11-06)

User requested an audit of every tool, to distinguish working implementations
from misleading or incomplete claims. No new thin tools this batch.

1. Inventory all 128 registered tools and map implementation, existing test
   coverage and limitations in a persistent audit report. Inspect every engine,
   prioritising claims that can cause wrong output or data loss. Check actual
   working logic, validation and known browser/API restrictions, not just links.
2. Exercise representative and boundary cases, plus real file processing where
   feasible. Identify unverified tools explicitly instead of declaring all good.
3. Fix confirmed high-impact defects and misleading descriptions in one batch;
   add regression tests, keep local processing and existing routes intact.
4. Rebuild, full checks, audit dependencies, one PR, CI and deployment verification.
   Report outstanding manual real-browser/device/file and accessibility testing
   honestly. GSC is independent and must not block this work.

Audit inventory and limitations: `TOOL-AUDIT.md`. All 128 UIs mounted in
jsdom; this is not per-tool certification. Confirmed high-impact calculation,
CSV, code-formatting and other bugs fixed. HTML minify disabled for safety.
Real-browser/file matrix and deeper per-tool validation remain open.
PR #21 merged, CI passed and production promoted; deeper audit remains open.

---

## 🚧 BATCH-16 — Deeper A-to-Z audit: media, PDFs and data integrity

Continue the audit requested by the user; no new tools or thin pages.
1. Investigate MP4 box parsing, bounds/extended-size handling and track isolation;
   test against independently generated real media where feasible and malformed
   synthetic fixtures. Never treat partial output as verified metadata.
2. Exercise actual generated PDF bytes through merge/split/rotate/organize UI
   paths; test file selection, empty/malformed inputs and preservation limits.
3. Audit image and audio validation, binary signatures, metadata and async/stale
   output problems. Add targeted fixes and honest format/codec limitations.
4. Investigate remaining high-impact data/finance issues as time permits, record
   per-tool evidence, explicit unverified coverage and follow-up in TOOL-AUDIT.md.
5. Full tests, security audit, one PR, CI, and deployment verification. Browser,
   device, screen-reader and exhaustive file format verification remain distinct.

---

## 🚧 BATCH-17 — PDF integrity and asynchronous workflow audit

1. Review single-file inspect/export and multi-file output workflows for races,
   stale selections, changing options and misleading download status.
2. Fix confirmed defects, disclose document-preservation and download limits,
   and test actual output PDFs plus delayed-selection and failure paths.
3. Run full build, automated checks and dependency audit. Record what remains
   unverified in TOOL-AUDIT.md; ship one coherent PR and verify production.

---

## 🚧 BATCH-18 — Image processing and metadata integrity

1. Audit image dimensions, memory bounds, EXIF/PNG metadata parsing and
   unsupported or malformed files; avoid unchecked allocations and false claims.
2. Fix asynchronous output races, failed-download reporting and preview URL
   lifetime; verify with adversarial fixtures and UI regression tests.
3. Run full checks and dependency audit; document remaining real-browser and
   image-fidelity gaps, then ship one PR and verify deployment.

---

## 🚧 BATCH-19 — Data conversion integrity audit

1. Audit CSV, JSON and JSONL edge cases for silent data loss, unsafe numeric
   conversion, duplicate keys and stale async file input.
2. Add targeted rejection or explicit disclosures where lossless conversion is
   not possible; test malformed inputs, numeric boundaries and UI race paths.
3. Run full checks and dependency audit, update TOOL-AUDIT.md with honest limits,
   then ship a single PR and verify production deployment.

---

## 🚧 BATCH-20 — JSON developer tool integrity

1. Audit formatter, minifier, validator and comparison for numeric precision,
   duplicate keys, deep nesting, stale results and resource safety.
2. Preserve original JSON tokens for formatting/minification, prevent unsafe
   comparisons, share numerical guards with data converters, and disclose limits.
3. Add edge-case and UI tests; run full checks and security audit; update audit
   evidence and ship one PR followed by production verification.

---

## 🚧 BATCH-21 — Financial calculator integrity

1. Audit savings, withdrawal, loan and investment formulas and input boundaries;
   verify representative scenarios against independently calculated results.
2. Fix confirmed incorrect outputs and stale UI states, disclose assumptions and
   numerical limits, and add targeted engine and UI regression tests.
3. Run the complete checks and dependency audit, update TOOL-AUDIT.md with
   evidence and remaining gaps, then ship one PR and verify production.

---

## 🚧 BATCH-22 — Developer and security tool reliability

1. Audit Base64, URL encoding, timestamps, JWT, hashing and password tools for
   silent data corruption, misleading claims, edge cases and async races.
2. Repair confirmed issues, document assumptions, and add independent vectors
   and targeted UI regressions; avoid claiming exhaustive security validation.
3. Run all checks and dependency audit, update TOOL-AUDIT.md, ship one PR and
   verify its production deployment.

---

## 🚧 BATCH-29 — Color tools integrity and accessibility audit

1. Audit color parsing, alpha preservation, preview/copy consistency, WCAG
   contrast thresholds, palette generation and stale/async UI paths against
   published CSS and WCAG guidance.
2. Fix confirmed data-loss and misleading-result bugs in one cohesive batch;
   make unsupported formats and precision limitations explicit.
3. Add engine and DOM regressions, run the full build/check and dependency audit,
   update TOOL-AUDIT.md, then ship one CI-verified PR and verify production.

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
