# A-to-Z tool audit — 2026-11-06

## Scope and evidence

128 registered routes were inventoried, their engine mappings checked, and all
128 UIs mounted in jsdom via an automated smoke test. A mount is **not** proof
that every input, calculation, file format or browser works. The existing engine
and DOM suites exercise many representative cases, but are not exhaustive.
This report records implementation families and known gaps, not 128 individual
certifications. No real browser, screen reader, device, camera/microphone,
canvas pixel comparison, or diverse user-file matrix was available.

## Confirmed issues repaired in this batch

- Compound interest previously added the advertised monthly contribution once
  per *compounding period*; yearly/daily settings produced wrong contributions.
  It now uses an equivalent monthly growth rate and actual monthly deposits.
- EMI accepted fractional/unbounded durations and invalid rates; PPF, SIP and RD
  had inconsistent or unbounded duration loops. Relevant boundaries are now
  checked. Income tax standard deduction is limited to salary and surcharge
  marginal relief is applied; the FY 2025–26 estimate assumes ordinary income
  for a resident, not a comprehensive filing calculation.
- CSV conversion silently overwrote duplicate headers, auto-converted IDs such
  as 001, accepted malformed quoted fields and removed lone CRs. Default is now
  text preservation, optional type inference is explicit, duplicate columns and
  malformed quotes fail, and JSONL error line numbers include blank lines.
- Handwritten HTML/CSS/JS formatting could change code or content. Parser-based
  local Prettier and CSS Tree replace those algorithms; HTML minification is
  deliberately unavailable rather than returning potentially unsafe output.
  Review and test formatted output; formatters do not guarantee equivalence for
  every syntax extension, template or whitespace-sensitive document.
- Alpha was ignored in contrast checks, large fractions could silently lose
  precision, PNG color types were mislabelled, random ranges were overclaimed,
  and small classic lorem counts were wrong. Tests cover these regressions.

## Known gaps and follow-up

1. MP4 parsing is best effort. Extended-size boxes may stop traversal, truncated
   files can yield incomplete metadata, and synthetic test data is not evidence
   that all MP4/MOV variants work. Cross-check media metadata externally.
2. Audio/video decoding is browser- and codec-dependent. Actual playback,
   extraction, seeking, file size limits and downloads need manual device tests.
3. PDF tests use generated documents; encrypted, signed, forms, attachments,
   bookmarks and unusual real-world PDFs need a fixture matrix. Image Canvas
   tests are mocked; real output fidelity, orientation, metadata and color
   profiles are not yet comprehensively verified.
4. All 128 tools need deeper per-tool boundary and claim verification; especially
   old finance formulas, JS/CSS/HTML semantics, timestamps, security heuristics,
   SEO generated output and real-device usability. No universal accuracy or
   legal/medical/financial guarantee can be made from the current suite.
5. GSC indexing, real-device accessibility, offline/install and Lighthouse
   checks remain pending. HTML minification was removed rather than disguised
   as a working feature. CSV exports should be treated as untrusted by spreadsheet
   software, as quoting alone does not stop formulas.

## Complete inventory (all mounted in jsdom; not individually certified)

### developer (15)

Parser/encoder logic and UI; browser clipboard/Web Crypto require device verification.

- [JSON Formatter](/tools/json-formatter/) — `json-formatter`
- [JSON Validator](/tools/json-validator/) — `json-validator`
- [JSON Minifier](/tools/json-minifier/) — `json-minifier`
- [Base64 Encoder & Decoder](/tools/base64-encoder/) — `base64-encoder`
- [URL Encoder & Decoder](/tools/url-encoder/) — `url-encoder`
- [UUID Generator](/tools/uuid-generator/) — `uuid-generator`
- [Timestamp Converter](/tools/timestamp-converter/) — `timestamp-converter`
- [Hash Generator](/tools/hash-generator/) — `hash-generator`
- [Regex Tester](/tools/regex-tester/) — `regex-tester`
- [JWT Decoder](/tools/jwt-decoder/) — `jwt-decoder`
- [HTML Formatter](/tools/html-formatter/) — `html-formatter`
- [CSS Formatter](/tools/css-formatter/) — `css-formatter`
- [JavaScript Formatter](/tools/js-formatter/) — `js-formatter`
- [Number Base Converter](/tools/number-base-converter/) — `number-base-converter`
- [JSON Compare](/tools/json-compare/) — `json-compare`

### audio (5)

DSP and synthetic container tests; actual codec support, playback and downloads require real browsers/files.

- [Extract Audio from Video](/tools/extract-audio/) — `extract-audio`
- [MP4 Inspector](/tools/mp4-inspector/) — `mp4-inspector`
- [Tone Generator](/tools/tone-generator/) — `tone-generator`
- [Audio Trimmer](/tools/audio-trimmer/) — `audio-trimmer`
- [Audio Speed Changer](/tools/audio-speed-changer/) — `audio-speed-changer`

### text (10)

Pure text operations; output conventions and large inputs require additional individual checks.

- [Word Counter](/tools/word-counter/) — `word-counter`
- [Character Counter](/tools/character-counter/) — `character-counter`
- [Line Counter](/tools/line-counter/) — `line-counter`
- [Case Converter](/tools/case-converter/) — `case-converter`
- [Remove Duplicate Lines](/tools/remove-duplicate-lines/) — `remove-duplicate-lines`
- [Text Sorter](/tools/text-sorter/) — `text-sorter`
- [Text Diff](/tools/text-diff/) — `text-diff`
- [Slug Generator](/tools/slug-generator/) — `slug-generator`
- [Lorem Ipsum Generator](/tools/lorem-ipsum-generator/) — `lorem-ipsum-generator`
- [Morse Code Translator](/tools/morse-code-translator/) — `morse-code-translator`

### calculators (34)

Formula/validation tests cover examples and specific regressions, not all financial rules or combinations.

- [Percentage Calculator](/tools/percentage-calculator/) — `percentage-calculator`
- [Percentage Change Calculator](/tools/percentage-change/) — `percentage-change`
- [Discount Calculator](/tools/discount-calculator/) — `discount-calculator`
- [Age Calculator](/tools/age-calculator/) — `age-calculator`
- [BMI Calculator](/tools/bmi-calculator/) — `bmi-calculator`
- [GST Calculator](/tools/gst-calculator/) — `gst-calculator`
- [EMI Calculator](/tools/emi-calculator/) — `emi-calculator`
- [Tip Calculator](/tools/tip-calculator/) — `tip-calculator`
- [Compound Interest Calculator](/tools/compound-interest-calculator/) — `compound-interest-calculator`
- [Simple Interest Calculator](/tools/simple-interest-calculator/) — `simple-interest-calculator`
- [SIP Calculator](/tools/sip-calculator/) — `sip-calculator`
- [PPF Calculator](/tools/ppf-calculator/) — `ppf-calculator`
- [FD Calculator](/tools/fd-calculator/) — `fd-calculator`
- [Income Tax Calculator](/tools/income-tax-calculator/) — `income-tax-calculator`
- [RD Calculator](/tools/rd-calculator/) — `rd-calculator`
- [CAGR Calculator](/tools/cagr-calculator/) — `cagr-calculator`
- [Gratuity Calculator](/tools/gratuity-calculator/) — `gratuity-calculator`
- [Lumpsum Calculator](/tools/lumpsum-calculator/) — `lumpsum-calculator`
- [NPS Calculator](/tools/nps-calculator/) — `nps-calculator`
- [EPF Calculator](/tools/epf-calculator/) — `epf-calculator`
- [HRA Calculator](/tools/hra-calculator/) — `hra-calculator`
- [Final Grade Calculator](/tools/final-grade-calculator/) — `final-grade-calculator`
- [Savings Goal Calculator](/tools/savings-goal-calculator/) — `savings-goal-calculator`
- [SWP Calculator](/tools/swp-calculator/) — `swp-calculator`
- [Electricity Cost Calculator](/tools/electricity-cost-calculator/) — `electricity-cost-calculator`
- [Fuel Cost Calculator](/tools/fuel-cost-calculator/) — `fuel-cost-calculator`
- [Loan Prepayment Calculator](/tools/loan-prepayment-calculator/) — `loan-prepayment-calculator`
- [Inflation Calculator](/tools/inflation-calculator/) — `inflation-calculator`
- [Work Hours Calculator](/tools/work-hours-calculator/) — `work-hours-calculator`
- [Profit Margin Calculator](/tools/profit-margin-calculator/) — `profit-margin-calculator`
- [50/30/20 Budget Calculator](/tools/budget-calculator/) — `budget-calculator`
- [Emergency Fund Calculator](/tools/emergency-fund-calculator/) — `emergency-fund-calculator`
- [Debt-to-Income Ratio Calculator](/tools/debt-to-income-calculator/) — `debt-to-income-calculator`
- [Break-Even Calculator](/tools/break-even-calculator/) — `break-even-calculator`

### converters (13)

Shared engine tests cover factors and boundaries; rounding and scientific-notation limits apply.

- [Length Converter](/tools/length-converter/) — `length-converter`
- [Weight Converter](/tools/weight-converter/) — `weight-converter`
- [Temperature Converter](/tools/temperature-converter/) — `temperature-converter`
- [Time Unit Converter](/tools/time-converter/) — `time-converter`
- [Speed Converter](/tools/speed-converter/) — `speed-converter`
- [Data Storage Converter](/tools/data-storage-converter/) — `data-storage-converter`
- [Area Converter](/tools/area-converter/) — `area-converter`
- [Volume Converter](/tools/volume-converter/) — `volume-converter`
- [Pressure Converter](/tools/pressure-converter/) — `pressure-converter`
- [Energy Converter](/tools/energy-converter/) — `energy-converter`
- [Power Converter](/tools/power-converter/) — `power-converter`
- [Fuel Economy Converter](/tools/fuel-economy-converter/) — `fuel-economy-converter`
- [Roman Numeral Converter](/tools/roman-numeral-converter/) — `roman-numeral-converter`

### security (3)

Uses Web Crypto; entropy/strength is heuristic and browser conditions require validation.

- [Password Generator](/tools/password-generator/) — `password-generator`
- [Password Strength Checker](/tools/password-strength-checker/) — `password-strength-checker`
- [Random String Generator](/tools/random-string-generator/) — `random-string-generator`

### image (9)

Canvas/browser encoder and file workflows need real-browser testing; mocked canvas is not pixel verification.

- [Image Compressor](/tools/image-compressor/) — `image-compressor`
- [Image Resizer](/tools/image-resizer/) — `image-resizer`
- [Image Converter](/tools/image-converter/) — `image-converter`
- [Image Cropper](/tools/image-cropper/) — `image-cropper`
- [Image Metadata Viewer](/tools/image-metadata-viewer/) — `image-metadata-viewer`
- [JPG to PNG Converter](/tools/jpg-to-png/) — `jpg-to-png`
- [PNG to JPG Converter](/tools/png-to-jpg/) — `png-to-jpg`
- [WebP to PNG Converter](/tools/webp-to-png/) — `webp-to-png`
- [JPG to WebP Converter](/tools/jpg-to-webp/) — `jpg-to-webp`

### color (4)

Color parsing and contrast tests include opaque-color requirement; visual accessibility requires independent review.

- [Color Picker](/tools/color-picker/) — `color-picker`
- [HEX / RGB / HSL Converter](/tools/hex-rgb-converter/) — `hex-rgb-converter`
- [Color Contrast Checker](/tools/color-contrast-checker/) — `color-contrast-checker`
- [Palette Generator](/tools/palette-generator/) — `palette-generator`

### webseo (9)

Generators and QR encode/decode have tests; search-engine behaviour and third-party requests require independent checks.

- [Meta Tag Generator](/tools/meta-tag-generator/) — `meta-tag-generator`
- [Robots.txt Generator](/tools/robots-txt-generator/) — `robots-txt-generator`
- [Sitemap Generator](/tools/sitemap-generator/) — `sitemap-generator`
- [Open Graph Preview](/tools/open-graph-preview/) — `open-graph-preview`
- [URL Parser](/tools/url-parser/) — `url-parser`
- [Keyword Density & Frequency Checker](/tools/keyword-density-checker/) — `keyword-density-checker`
- [YouTube Thumbnail Downloader](/tools/youtube-thumbnail-downloader/) — `youtube-thumbnail-downloader`
- [QR Code Generator](/tools/qr-code-generator/) — `qr-code-generator`
- [QR Code Scanner](/tools/qr-code-scanner/) — `qr-code-scanner`

### student (5)

Pure expression, fraction and education models; institutional/rounding assumptions apply.

- [Scientific Calculator](/tools/scientific-calculator/) — `scientific-calculator`
- [Fraction Calculator](/tools/fraction-calculator/) — `fraction-calculator`
- [Time Duration Calculator](/tools/time-duration-calculator/) — `time-duration-calculator`
- [CGPA Calculator](/tools/cgpa-calculator/) — `cgpa-calculator`
- [Attendance Calculator](/tools/attendance-calculator/) — `attendance-calculator`

### math (4)

Bounded numeric engines with tests; floating-point rounding is disclosed.

- [Average Calculator](/tools/average-calculator/) — `average-calculator`
- [Ratio Calculator](/tools/ratio-calculator/) — `ratio-calculator`
- [GCD & LCM Calculator](/tools/gcd-lcm-calculator/) — `gcd-lcm-calculator`
- [Weighted Average Calculator](/tools/weighted-average-calculator/) — `weighted-average-calculator`

### datetime (5)

Gregorian date-only/DST cases tested; timezone results depend on browser timezone database.

- [Date Difference](/tools/date-difference/) — `date-difference`
- [Date Add / Subtract](/tools/date-add-calculator/) — `date-add-calculator`
- [Time Zone Converter](/tools/time-zone-converter/) — `time-zone-converter`
- [Business Day Calculator](/tools/business-day-calculator/) — `business-day-calculator`
- [ISO Week Number Calculator](/tools/iso-week-calculator/) — `iso-week-calculator`

### data (3)

CSV/JSON conversion tests include data-loss cases; spreadsheet formula execution remains a user risk.

- [CSV to JSON](/tools/csv-to-json/) — `csv-to-json`
- [JSON to CSV](/tools/json-to-csv/) — `json-to-csv`
- [JSON Lines Converter](/tools/json-lines-converter/) — `json-lines-converter`

### misc (4)

Randomness and timing tested in isolation; real animations and device timing require browser tests.

- [Random Number Generator](/tools/random-number-generator/) — `random-number-generator`
- [Dice Roller](/tools/dice-roller/) — `dice-roller`
- [Spin the Wheel — Random Name Picker](/tools/spin-wheel/) — `spin-wheel`
- [Typing Speed Test](/tools/typing-speed-test/) — `typing-speed-test`

### pdf (5)

PDF-lib has real generated-PDF tests for some operations; diverse documents, attachments and real downloads require manual validation.

- [PDF Merge](/tools/pdf-merge/) — `pdf-merge`
- [PDF Rotate](/tools/pdf-rotate/) — `pdf-rotate`
- [PDF Split](/tools/pdf-split/) — `pdf-split`
- [Image to PDF](/tools/image-to-pdf/) — `image-to-pdf`
- [PDF Page Organizer](/tools/pdf-organizer/) — `pdf-organizer`


## Batch-16 deeper media/PDF checks

- MP4 inspector now bounds-checks box sizes and nesting, supports extended and
  zero-sized boxes, associates metadata with each track, handles unknown movie
  duration, and warns for fragmented/missing metadata. A 2-second FFmpeg-created
  H.264/AAC fixture independently identified as 128×96 was parsed in engine
  tests, alongside malformed and synthetic boxes. This is best-effort inspection,
  not a full ISO-BMFF validator or codec verification; other layouts, edit lists,
  encryption and unusual files remain unverified.
- Audio trimmer, speed changer and extraction invalidate older async decodes;
  trimmer validates the requested range instead of silently replacing zero/empty
  end with the full duration. A mocked decoder tests out-of-order selection and
  failed loads. Input is limited to 100 MiB and 30 million decoded samples;
  slowed output is also limited. Decode itself can still consume significant
  memory; actual browser codec support and playback were not tested here.
- Image sniffing checks complete PNG/GIF signatures and RIFF for WebP instead of
  accepting short or unrelated headers. This identifies formats, not file validity.
- Existing organizer and merge tests reload generated PDFs; added rotate and
  split UI tests reload generated output and verify rotation and page selection.
  These are small synthetic documents, not proof of preserving forms, annotations,
  bookmarks, signatures or arbitrary PDF structures. Real browser downloads,
  image-to-PDF pixels, encrypted documents, and multi-download behavior remain
  unverified. Rotate/split still need async selection-race review.
- All 128 mounts remain smoke tests only. Further systematic per-tool input,
  boundary, output and cross-browser testing is still required.
