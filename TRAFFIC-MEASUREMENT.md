# Search traffic measurement (local only)

The existing Drive export named `Performance-on-Search-2026-11-22` has daily data through November 19, later than the session date of October 31, 2026. Reconcile its chronology before using it as current evidence. The on/before October 31 rows contain just one impression and no clicks; that is too small to identify opportunities. There is no verified current page-filtered baseline, and this repository contains no private exports.

## Before and after

1. In Search Console, select the same verified property, Web search type, country and device filters. Export the **Pages** table as English CSV for two equal, nonoverlapping periods. Include completed days and allow for Search Console data lag; record exact dates and all filters separately. Google may omit rows; the utility cannot detect truncation or filter changes. Never match an unfiltered Queries table to a Pages table.
2. Keep the files outside the repository. Run, replacing paths, windows, as-of and origin with actual values:

   ```sh
   node scripts/traffic-report.mjs /path/recent-pages.csv /path/previous-pages.csv 2026-10-17:2026-10-30 2026-10-03:2026-10-16 2026-10-31 https://i-have-tools.vercel.app
   ```

   This is an example of equal windows, **not** a claim that these exports exist. The command outputs a local Markdown table; it does not upload or save data. English CSV, up to 1 million characters and 9,999 data rows per file, is supported. The report includes only recent-export pages. Query strings and other origins are rejected so those rows are not silently combined; investigate them separately. The supplied as-of date and filters are not verified against Search Console.
3. For priority pages, filter the Performance report **to that page first**, then inspect queries and relevant country/device slices. Compare clicks and impressions over the two windows, CTR alongside average position, and absolute numbers. Check indexing separately with URL Inspection. Use Google's [performance report guidance](https://support.google.com/webmasters/answer/7576553) and [indexing documentation](https://developers.google.com/search/docs/monitor-debug/search-console-start).
4. Do not claim that an improvement caused a change without controlling for indexing lag, seasonality, query mix, SERP changes and low counts. Missing rows are unknown, not zero. Search Console clicks are not all site traffic and position is an aggregate. No ranking or traffic guarantee.
