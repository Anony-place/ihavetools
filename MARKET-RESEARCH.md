# Market and competitor research — 2026-10-31

## Consolidated research for numbered batches (2026-10-31)

Inventory checked directly from registry: 164 unique tools, 142 with authored guides; categories overlap. Existing PDF tools cover merge, split, rotate, organizer/page numbering, PDF↔image and limited Info inspection. Existing bulk resizer already supports compression, watermarking and naming. Existing developer category contains JSON syntax validation, compare, pointer, CSV conversions and regex testing. Avoid proposing those as new work.

| Evidence | Observation | Decision / caveat |
|---|---|---|
| [PDF24 official](https://tools.pdf24.org/en/) | Broad PDF workflow suite; online processing uses their servers, offline product is separate. | Batch 1 focuses on three distinct missing jobs: text-layer extraction, text watermark and page-size inspection; local bounded processing. No assumption of measured demand. |
| [PDF.js API](https://mozilla.github.io/pdf.js/api/draft/module-pdfjsLib-PDFPageProxy.html) | `getTextContent`/stream API returns text items, not OCR or a guarantee of visual reading order. | Explicitly warn about scanned pages, columns, fonts and extraction limits; test actual files and cancellation. |
| [pdf-lib](https://pdf-lib.js.org/) | Supports text drawing, PDF manipulation and standard fonts. | Watermark geometry, crop/rotation, character coverage, file features and signatures require careful validation; no security claims. |
| [iLoveIMG official](https://www.iloveimg.com/resize-image) | Bulk dimension tasks are a normal workflow. | Batch 2 audit first: much already exists here; seek real gaps rather than clone. |
| [JSON Editor Online](https://jsoneditoronline.org/features/) | Supports validation, schema validation, tree, conversion and comparisons. | Batch 3 investigate a safe, bounded, offline schema validator; no parity or demand claim. |
| [Google Search Console](https://developers.google.com/search/docs/monitor-debug/search-console-start) | Performance and indexing are distinct and can be filtered/inspected. | No fabricated keyword volumes or SEO outcomes; use comparable page-filtered data only when chronology is reconciled. |

Full scopes, ordering, risks and release criteria live in `PLAN.md`. Small changes are grouped into a complete substantive batch per PR, not shipped one at a time.

## What is and isn't measured
The supplied Search Console export is labelled 2026-11-12 and its chart includes dates after the session date (2026-10-31). Its chronology needs verification before using it as current evidence. It reports impressions for this site, not overall market search volume; query and page totals are not automatically attributable to one another. No independent keyword-volume or Trends comparison was available in this pass. Therefore the ordering below is an implementation hypothesis, not a measured ranking of market demand.

## Opportunities and constraints
| Opportunity | Evidence and user need | Proposed next investigation |
|---|---|---|
| PDF workflows | [PDF24](https://tools.pdf24.org/en/) offers an extensive free suite and distinguishes server processing from its offline desktop product. This suggests competitive pressure around usability and privacy, not a quantified market. Our split/organize/number tools already cover several jobs. | Test common real documents, mobile memory limits and fidelity; seek GSC page-filtered queries before adding another page. |
| Bulk image tasks | [iLoveIMG](https://www.iloveimg.com/) lists bulk resizing, conversion, rotation and watermarking. These are established competing workflows, not proof of volume. | Assess crop/format gaps and client-side limits against existing bulk resizer; avoid promising costly AI or unsupported formats. |
| Developer JSON | [JSON Editor Online](https://jsoneditoronline.org/features/) offers tree/table views, comparison, repair and schema validation. | Evaluate bounded, local schema validation as a potential substantive improvement, including dependency/security and large-file constraints; do not claim parity. |
| Student attendance | [Attendance planner](https://toolistify.com/student-tools/attendance-calculator) offers optional remaining classes and feasibility. | Finite term planning added in this batch; validate with students and institutions because equal class weighting may not match their rules. |
| Roman numerals | [Roman converter](https://onlinecalculator360.com/roman-numeral-converter/) describes a symbol breakdown. | Breakdown added in this batch; test actual search intent before expanding the supported notation. |
| Robots.txt | [Google's robots guidance](https://developers.google.com/crawling/docs/robots-txt/create-robots-txt) covers root placement and syntax. | Editable rules added in this batch; verify behavior with official crawler examples, noting robots is not access control. |

## Free validation plan
1. Re-export a correctly dated GSC report with page-filtered queries and comparable date windows; record country, device and coverage before interpreting changes. Small samples are noisy.
2. Compare terms in the same geography, category and period with Google Trends, noting search terms versus topics. [Google says](https://support.google.com/trends/answer/4365533?hl=en) Trends is a normalized sampled 0–100 index, not absolute volumes; low-volume zeros and noisy spikes need caution. No Trends values are asserted here.
3. Prioritize a small number of meaningful workflows based on query intent, user feedback, local feasibility, accessibility and testability—not competitor feature counts or invented search volumes. Recheck after enough data; no ranking guarantee.
