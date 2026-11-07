# A-to-Z tool audit — 2026-11-06

## Scope and evidence

128 registered routes were inventoried, their engine mappings checked, and all
128 UIs were smoke-tested in jsdom. The original smoke test missed startup error
banners; Batch 22 fixes this assertion and all 128 pass the strengthened check.
A mount is **not** proof
that every input, calculation, file format or browser works. The existing engine
and DOM suites exercise many representative cases, but are not exhaustive.
This report records implementation families and known gaps, not 128 individual
certifications. A headless Chromium audit is now available (see below). No
physical-device, screen-reader, physical camera/microphone or diverse user-file
matrix was available.

## Image metadata trust and sitemap dates — 2026-11-07

- Reviewed private image workflows: batch processing and local handling are
  offered by competitors, e.g. https://www.image2url.com/image-compressor . This
  is a feature observation, not proof of search demand or a ranking prediction.
- The metadata viewer reads selected tags in the first JPEG EXIF block and lists
  PNG chunks; it does not decode PNG EXIF, XMP, IPTC, all JPEG tags or other
  formats. UI and page copy now explicitly warn that missing output is not proof
  of absent metadata/location and that the viewer does not remove metadata.
- JPEG marker fill bytes are accepted; malformed marker segments are reported as
  incomplete rather than absent. GPS BYTE altitude reference is read, latitude/
  longitude DMS retain more displayed precision, and zero EXIF rational
  denominators or invalid directory pointers make the block unreadable instead
  of inventing values. Crafted fixture and DOM tests cover these cases. This is
  still not an exhaustive EXIF parser or a privacy guarantee for real photos.
- Builds no longer stamp trust pages with the current build date or claim that
  every tool's creation date is its last modification. Sitemap lastmod and tool
  structured-data dateModified are emitted only for explicitly maintained dates;
  unknown dates are omitted. See Google's sitemap guidance:
  https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap
  Future meaningful edits need their actual `modified` date maintained manually;
  there is no promise of indexing or ranking from this change.
- `npm run check`: 228 engine, 142 DOM, 9 site-chrome, service worker and 21
  integrity checks pass. Dependency audit finds zero vulnerabilities. The CI
  Chromium suite includes a decoded JPEG metadata result, mobile width and axe
  scan; local real-browser execution depends on an available Chromium runtime.

## Real Chromium and accessibility audit — 2026-11-06

- Obtained headless Chromium 153 from the npm distribution and built missing
  NSPR libraries from Mozilla source; temporary browser/runtime files are not
  shipped in the site. `scripts/test-browser.mjs` is repeatable with an installed
  Chromium and checks all 128 tool mounts at both 320px and 390px. The initial
  run found horizontal page overflow across most routes, plus literal SVG markup
  rendered in shared copy/download buttons. Grid sizing, long labels, the wheel
  width, actual icons and accessible copy names were corrected. This measures
  document overflow at default states, not every generated output or device.
- Real browser downloads were independently inspected: JSON preserves a large
  numeric token, QR PNG decodes with jsQR preserving whitespace, canvas output
  retains dimensions, a two-file PDF merge reloads as two pages, and generated
  WAV has the expected header. Actual clipboard permissions, audio playback,
  physical cameras, varied formats and large files were not verified.
- Axe WCAG 2 A/AA and 2.1 A/AA scans ran on the homepage and all 128 tool pages
  in both light and dark themes at 390px, with no automated violations on initial
  states. Fixed low-contrast text, unlabeled inputs, dark controls, focusable
  scrolling regions, links and nested file-input controls. The file picker was
  also keyboard-triggered in Chromium. Automated axe checks are not a full
  accessibility audit; screen readers, dynamic states and other browsers remain.
- Registered the real service worker manually on localhost to verify a visited
  tool loads offline, an unvisited tool shows the offline page and query strings
  are not cached. This is not a real-device PWA installation test.
- The UUID generator now rejects fractional/out-of-range counts and invalidates
  old results on settings changes. Shared download buttons report URL creation
  failures instead of claiming success. Full `npm run check` and npm audit passed;
  CI runs the shorter representative browser suite with preinstalled Chrome.

## Consolidated audit — release evidence (PR #36)

- Unit converter inputs that underflow to zero are rejected instead of reporting
  zero. Roman number input requires decimal whole-number notation rather than
  silently accepting JavaScript hexadecimal, decimal fractions or exponent syntax.
  DOM regressions cover invalid and valid inputs. This is not certification of
  all tool families.
- Date/time UIs now clear stale results after edits. Time-zone “Now” uses the
  selected source zone rather than the device zone, to minute precision. Historic
  offsets containing seconds are shown without truncating the resulting instant;
  calculations still rely on the browser's time-zone database. Date-add's Unix
  value is explicitly identified as local start-of-day. Reference:
  https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/DateTimeFormat/formatToParts
- Data conversion applies limits to pasted CSV and JSONL as well as files: CSV
  text 1 million characters, 10,000 rows including header, 256 columns, 250,000
  cells; CSV-to-JSON and pretty JSONL-to-array results have conservative
  10-million-character expansion guards. JSON-to-CSV has 10,000 rows / 256
  columns / 250,000 cells. JSONL has 1 million input characters and 10,000
  lines or array records. Limits prevent some expansions but do not guarantee
  responsiveness on every device. CSV spreadsheet formula execution remains a
  risk; conversion does not sanitize or preserve all JSON types.
- Tone generation no longer silently substitutes defaults for blank or zero
  frequency/duration. Editing settings invalidates pending playback and stops the
  previous source; pagehide closes its AudioContext. Downloads report requests,
  not guaranteed saves. WAV encoding checks channel lengths, samples and limits;
  speed processing discloses hard clipping and linear resampling without an
  anti-alias filter. Tests use mocked Web Audio, not physical playback, actual
  browser codec compatibility, saved-file dialogs or perceptual quality. See
  https://developer.mozilla.org/en-US/docs/Web/API/AudioBufferSourceNode
- Line deduplication/sorting recognize CR, LF and CRLF; output uses LF. The
  internal shuffle uses Fisher–Yates rather than a random sort comparator (and
  is not a cryptographic draw). Title case handles leading whitespace without
  copying the full preceding text for every word. Locale and language-specific
  title-case and sorting conventions remain approximate. Comparator guidance:
  https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/sort
- Current automated evidence: 227 engine and 139 DOM tests, 9 chrome tests,
  service-worker and 20 integrity checks passed; dependency audit found zero
  vulnerabilities. Earlier attempts lacked NSS/NSPR; see the newer Chromium
  audit above for the subsequent resolution and scope of real-browser coverage.

## Batch 29 — color tool integrity

- HEX/RGB/HSL converter retains alpha in generated formats, preview and copy;
  invalid input clears other fields and disables copying. Bare comma-separated
  RGB input now works as advertised. HEX alpha is quantized to 8 bits; RGB and
  HSL channels are rounded, so round trips can change values. The parser covers
  a subset of CSS colors, not named colors or all modern CSS syntax. Reference:
  https://developer.mozilla.org/en-US/docs/Web/CSS/color_value
- The opaque color picker rejects transparent HEX instead of silently discarding
  alpha, leaves typed text intact, clears stale results and ignores late screen
  picker results after input changes or pagehide. EyeDropper is browser-dependent
  and was mocked in tests, not exercised on a physical device.
- Palette harmonies preserve the exact selected base, including black and white;
  monochromatic palettes now include all five planned shades. Other colors use
  rounded HSL and aren't a perceptual color-space harmony guarantee.
- Contrast pass/fail uses the unrounded ratio even when a displayed ratio rounds
  across a threshold. For instance #070707 on #777777 displays 4.50:1 but fails
  4.5:1. WCAG's guidance: https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html
  The tool checks opaque color pairs only; this is not full WCAG certification.
- Regression coverage includes alpha, copy/invalidation, exact palette bases,
  mocked eyedropper races and contrast thresholds. Real browser rendering,
  clipboard permissions, assistive technology and screen picking remain unverified.

## Batch 28 — student and math calculator accuracy

- Scientific calculator now starts in the displayed DEG mode, accepts scientific
  notation and displayed multiplication/division/minus symbols, guards expression
  size/depth, and clears stale results on input/mode changes. Floating-point
  arithmetic and 12-digit history/display rounding still apply.
- Attendance rejects fractional/blank counts and uses scaled integer arithmetic
  for target boundaries (1–100%, up to 6 decimals); very large required counts
  outside the safe integer range are rejected. Institutional attendance rules,
  excused absences, and future schedule details are not modeled.
- Duration rows require whole non-negative values with minute/second ranges and
  row/hour limits. GPA calculations reject incomplete or invalid subject rows;
  institutional grading and conversion formulas vary. Reference example of
  institution-specific grading: https://registrar.utexas.edu/students/grades/gpa
- Student and mathematics results are invalidated on relevant edits, subject or
  row changes. Extremely small non-zero numeric inputs that underflow to zero are
  rejected. Regression tests include brute-force small attendance cases, decimal
  boundaries, DEG/RAD, scientific notation, invalid durations and incomplete GPA
  rows. Real-browser usability and broad formula certification remain outstanding.

## Batch 27 — interactive random and typing tools

- Random number generation validates whole inputs and uses sparse partial
  Fisher–Yates for unique draws instead of repeatedly retrying duplicates. Dice
  reject fractional counts and sides; random/dice outputs clear on edits. Full
  integers are visible rather than truncated. Cryptographic random values come
  from the browser, not an independently certified draw; RNG rejection sampling
  can itself retry. See https://developer.mozilla.org/en-US/docs/Web/API/Crypto/getRandomValues
- Spin wheel now rejects excess or excessively long entries instead of silently
  dropping them, locks list and reorder actions during a spin, handles unavailable
  crypto, and clears the old winner when a list changes. Duplicate lines remain
  separate chances; removing one winner removes only one matching line.
- Typing duration buttons actually reset the test, elapsed time uses a monotonic
  clock, and input delivered after the deadline is excluded. Paste/drop blocking
  is best effort: scores are local, editable in principle and not verified.
  The score reflects final characters, not an audit of every keystroke.
- Engine tests cover all permutations of a tiny unique draw, range/length checks
  and deterministic worst-case sample completion. DOM tests cover deadline,
  duration reset, stale outputs and wheel locking. Physical animation alignment,
  diverse browsers, screen readers and external fairness certification remain
  unverified.

## Batch 26 — QR workflow integrity and camera lifecycle

- QR generator preserves leading/trailing payload whitespace, rejects unpaired
  surrogates, invalidates obsolete results and pending PNG callbacks, reports the
  actual rounded PNG size, and warns when foreground/background are identical.
  Non-identical colours can still have insufficient contrast: always test-scan.
- QR scanner preserves raw decoded text, uses per-operation tokens for file,
  decoder and camera races, lets users cancel while permission is pending, stops
  late-arriving streams and cleans preview URLs on pagehide (including repeat
  pagehide after a back-forward-cache restore). Image limit: 25 MiB and 40 million
  pixels; the browser may allocate memory before dimensions are checked.
- Added real encoder/jsQR round trips for whitespace and mocked DOM coverage for
  late library loading, pending PNG saves, out-of-order bitmaps, cancellation,
  oversized files and repeat pagehide. Camera permissions, image codecs, physical
  scanning and download behavior still require real browser/device checks.
- A permission prompt may remain unresolved: see MDN getUserMedia documentation
  https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia .

## Batch 25 — SEO generator output integrity

- Sitemap generator validates HTTP(S) URLs, a single origin, actual calendar
  dates, priority and frequency; rejects fragments and credentials; escapes XML
  and encodes non-ASCII URLs. It caps inputs at 10,000 URLs / 2 million
  characters. It does not support hreflang or guarantee crawling/indexing.
  Google ignores priority/changefreq and uses lastmod only when accurate:
  https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap
- Robots generator rejects malformed/injected user agents and paths and validates
  sitemap URLs and delay. The tester avoids regex-based wildcard backtracking and
  is explicitly approximate; percent encoding, crawler matching and compliance
  can differ. Robots.txt is not authentication or an indexing guarantee.
- Meta output requires a title and validates canonical/image URLs; editable
  sitemap, keyword and URL outputs clear on changes. The URL parser labels its
  last-two-hostname-label shortcut honestly (not a public-suffix calculation)
  and recognizes host:port input. YouTube host checks now reject lookalike suffixes.
- Keyword tokenization retains combining marks; inputs and expensive phrase
  comparisons are bounded. It is still not a language-aware word segmenter.
  OG preview is illustrative, does not fetch image content, and no longer claims
  to offer absent image/layout controls. QR async camera/file races and real
  browser/device validation remain follow-ups.

## Batch 24 — text integrity follow-up

- Empty input now reports zero total and blank lines; counting handles CRLF and
  CR. Reading-time formatting now matches the advertised 5-second rounding.
  Character meters explicitly warn that code points do not predict platform,
  SMS encoding, grapheme or search snippet limits. Word/sentence counts remain
  whitespace/punctuation heuristics, not language-aware segmentation.
- Latin diacritics are simplified without stripping essential combining marks
  from Indic scripts; programmer-style case conversion also retains marks.
  Slug output may still need percent-encoding and is not full transliteration.
- Sort deduplication respects the case option and keeps blank lines; sorting
  preserves input blank lines and handles non-numeric values consistently.
  Locale affects alphabetical order and numeric parsing uses a numeric prefix
  after skipping leading non-numeric characters, not arbitrary natural numbers.
- Diff no longer silently drops trailing newlines. Line endings are normalized;
  allocation is limited by both dimensions, cell count and total input length.
  Button-based text results clear when inputs/settings change or sides swap.
- Regression coverage includes Hindi combining marks, blank lines, numeric sort,
  asymmetric diff bounds, final newlines and stale output. Browser locale,
  language-specific casing/tokenization and very large interactive workloads
  remain limitations; no real-device testing was performed in this batch.
  Reference: MDN Intl.Collator sensitivity and locale-dependent ordering.

## Batch 23 — regex execution and output integrity

Regex evaluation now runs in a local module worker, terminated after one second
or immediately on edits; if workers are unavailable it fails closed. Input is
limited to 2,000 pattern and 100,000 text UTF-16 code units. Returned matches
are bounded to 1,000 and 500,000 serialized characters; individual captures
are shortened after 1,000 code units. The UI discloses caps, displays named
captures and UTF-16 positions, and preserves characters at zero-width matches.
The timeout includes worker startup and can reject legitimate slow patterns;
worker isolation is not a guarantee against all resource exhaustion. The Node
worker-thread adapter exercises real catastrophic backtracking and cancellation,
but real browsers, slow devices, and offline worker loading still need testing.
Reference: MDN JavaScript regular expression guide and the regexp-worker project
for background-thread termination of catastrophic backtracking.

## Batch 22 — developer and security follow-up

- Fixed a hash-generator startup error (`require_icon` was undefined), which the
  earlier smoke test had incorrectly reported as a successful mount. Hashing now
  ignores stale asynchronous results; file input is limited to 100 MiB.
- Base64 decoding preserves UTF-8 BOM and rejects invalid padding bits; encoding
  rejects unpaired surrogates. Timestamp units are explicit with documented auto
  detection and local DST caveats. JWT parsing requires three parts, object JSON
  and Base64URL characters, flags invalid date claims and copies actual JSON.
  Decoding never verifies signatures, issuer or validity.
- Random custom alphabets deduplicate Unicode code points and lengths must be
  whole numbers. Password strength is a limited heuristic, not measured entropy
  or proof of security. Estimated crack-time claims were removed.
- Added engine/DOM regressions, including out-of-order hash results, JWT copying,
  explicit timestamps and custom alphabets. Automated checks passed: 212 engine,
  113 DOM, 9 chrome, service worker and 20 integrity checks; npm audit reports
  zero vulnerabilities. jsdom/mocks are not real-browser or cryptographic audits.
- Batch 23 moves regex evaluation into a terminable worker; see below. Broader
  browser/device, security and accessibility validation remains outstanding.

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

## Batch-17 PDF workflow audit

- Rotate and split now snapshot the selected document and options for each run;
  changing the document or starting another action prevents older inspection or
  export results from updating the UI or initiating a later download. Selection
  clears prior output statistics. Split-per-page stops issuing further requests
  after a change, though downloads already requested cannot be recalled.
- Merge and image-to-PDF cancel pending results if their file list changes;
  image-to-PDF snapshots page size for consistent pages. Organizer page edits
  invalidate pending exports. PDF output uses browser download requests: a
  failure to create a download URL is reported, but browsers may still block
  or fail downloads after a request was made. Multi-download status reflects that.
- Page-copy tools now warn that forms, bookmarks, attachments and signatures may
  not be preserved; rotating a signed PDF invalidates the signature. Users should
  inspect the result. Added jsdom delayed-load tests for stale inspect/export and
  list changes, plus an object-URL failure test. Real browser dialogs, memory
  limits, varied PDF structures, actual image rendering and accessibility remain
  unverified; these tests do not certify every document or all 128 tools.

## Batch-18 image processing audit

- EXIF TIFF values now have APP1-bound checks and bounded counts before decoding;
  single rational values render as scalars. PNG parsing checks chunk bounds and
  limits chunk lists. These are partial metadata readers, not validators: CRCs,
  all tags and metadata formats are not verified. Malformed fixtures exercise
  oversized counts and truncated chunks.
- Compressor, resizer, converter and cropper invalidate stale async encodes on
  selection/settings changes and revoke replaced preview URLs. Resizer rejects
  invalid dimensions and JPEG output uses a white transparency background.
  Image inputs are limited to 100 MiB and canvas outputs to 16,384 pixels per
  side / 40 million total; actual device limits can be lower. Decoding can still
  consume significant memory before output limits apply.
- A jsdom test with mocked canvas checks delayed encoding, preview URL cleanup,
  and dimension bounds; this does **not** verify actual pixels or browser codecs.
  Canvas output can discard metadata and animation; this is now disclosed.
  Real image pixel fidelity, orientation behavior, accessibility, and a broad
  corpus of malformed/valid images remain unverified. Full 128-tool coverage is
  still an open audit, not a certification.

## Batch-19 data conversion integrity

- CSV headers retain whitespace instead of being silently trimmed. Empty headers
  still receive generated column names, a leading BOM is treated as an encoding
  marker, and duplicate names are rejected. Type inference remains opt-in and
  preserves unsafe integers, overflow/underflow and negative zero as text; other
  decimal values may still round or change representation.
- JSON-to-CSV and JSON/JSONL conversion now reject duplicate object keys (even
  escaped equivalents), unsafe integer numbers, numeric overflow/underflow and
  negative zero instead of silently overwriting or changing them. Exact decimal
  representation is not guaranteed: JSON numbers use JavaScript binary floating
  point; use strings for exact values. JSON-to-CSV maps null, missing and empty
  strings to the same empty cell, and serializes nested values as text. CSV is
  not a lossless general JSON format. An empty array is rejected for JSONL export.
- Input edits clear old conversion outputs; CSV file reads are revision-guarded
  against later selections, edits and manual conversions. File input is capped
  at 10 MiB. Automated tests include malformed/duplicate inputs, numeric
  boundaries and mocked out-of-order file reads. Spreadsheet formula injection
  remains a user risk, and full fidelity across spreadsheet programs, huge
  pasted inputs, browsers and all 128 tools is not certified.

## Batch-20 JSON developer tools

- JSON formatter and minifier now validate syntax and alter only whitespace;
  numeric literals, escape sequences, key order and duplicate keys are preserved
  rather than being reserialized through JavaScript numbers/objects. Duplicate
  keys are warned about because downstream parsers may overwrite them.
- JSON comparison now rejects duplicate keys, unsafe integers, overflow,
  underflow and negative zero instead of potentially reporting a false match.
  Decimal comparisons still use binary floating point and can round; for exact
  decimal comparison use strings or a specialised parser. This same guard is
  shared with the Batch-19 JSON converters.
- JSON inputs are limited to 1,000,000 characters and 256 nesting levels;
  formatted output is capped at 10,000,000 characters. Inputs and indentation
  changes clear stale formatter/minifier/comparison results. Tests cover exact
  token preservation, duplicate keys, number boundaries and resource limits.
  Tests are representative, not exhaustive parser, browser or 128-tool proof.

## Batch-21 finance calculator audit

- GST extraction previously labelled the gross amount as “pre-tax”; it now
  displays net and gross correctly and explains that the equal CGST/SGST split
  is illustrative for intra-state supply, not an IGST determination. CBIC's
  official FAQ distinguishes intra-state and inter-state taxes:
  https://cbic-gst.gov.in/hindi/faq.html
- FD and RD rates and deposit inputs now have finite bounds; their calculations
  use numerically stable log/exponential functions for very small rates. A
  60-digit Python Decimal reference checked 1e-9% examples. FD fractional-period
  compounding is an estimate: SBI's deposit-method page describes actual broken
  periods using day counts rather than assuming this formula universally:
  https://sbi.co.in/portal/web/interest-rates/deposit-rates
- Simple-interest rate/time and CAGR boundaries reject invalid/non-finite
  inputs; simple-interest day conversion explicitly uses 365 days. RD no longer
  silently rounds fractional years; tip splitting no longer silently rounds or
  defaults an invalid number of people. SWP handles a small floating-point
  residual at depletion; loan repayment accounts for small rounding residue.
- Edited inputs clear old results for the reviewed financial calculators. Engine
  and jsdom cases cover examples and boundary failures, not every bank product,
  day-count convention, tax scenario or real-browser behavior. Projections are
  estimates, not financial or tax advice. All-tool certification remains open.
