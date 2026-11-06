// Called in a terminable worker by the UI. Never execute untrusted regex on the UI thread.
export function findMatches(pattern, flags, text) {
  if (pattern.length > 2000 || text.length > 100000) return {error: 'Pattern limit is 2,000 characters; test string limit is 100,000 UTF-16 code units.'};
  let re;
  try { re = new RegExp(pattern, flags.includes('g') ? flags : flags + 'g'); }
  catch (e) { return { error: `Invalid regular expression: ${e.message}` }; }
  try {
    const matches = []; let truncated = false; let budget = 0;
    if (pattern === '') return { matches, truncated };
    const iterator = text.matchAll(re);
    for (const m of iterator) {
      // Long captures are shortened before crossing the worker boundary.
      const short = value => value === undefined ? undefined : value.length > 1000 ? value.slice(0, 1000) + '… [truncated]' : value;
      const groups = m.slice(1).map(short);
      const named = m.groups ? Object.fromEntries(Object.entries(m.groups).map(([k,v]) => [k,short(v)])) : null;
      const item = { index: m.index, text: short(m[0]), length: m[0].length, groups, named };
      budget += JSON.stringify(item).length;
      if (budget > 500000) { truncated = true; break; }
      matches.push(item);
      if (!flags.includes('g')) break;
      if (matches.length >= 1000) { truncated = true; break; }
    }
    return { matches, truncated };
  } catch (e) { return { error: e.message }; }
}
