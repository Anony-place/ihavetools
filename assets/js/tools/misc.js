// =============================================================================
// iHaveTools — Miscellaneous: random-number-generator (crypto-grade)
// =============================================================================
import { h, field, input, select, switchChip, btn, actionsRow, statusLine, statsGrid, toast, copyText, privacyNote, mountTool } from '../ui.js';
import { randomInt } from './security.js';

export function rollDice({ dice = 2, sides = 6 }) {
  if (!(dice >= 1 && dice <= 12)) throw new Error('Roll between 1 and 12 dice.');
  if (!(sides >= 2 && sides <= 100)) throw new Error('Dice need between 2 and 100 sides.');
  return Array.from({ length: dice }, () => 1 + randomInt(sides));
}

export function randomNumbers({ min, max, count, unique = false, sort = 'none', pad = 0 }) {
  if (!Number.isInteger(min) || !Number.isInteger(max)) throw new Error('Minimum and maximum must be whole numbers.');
  if (min > max) throw new Error('Minimum must be less than or equal to maximum.');
  const span = max - min + 1;
  if (unique && count > span) throw new Error(`Cannot pick ${count} unique numbers from a range of only ${span}.`);
  const out = [];
  const seen = new Set();
  while (out.length < count) {
    const n = min + randomInt(span);
    if (unique) { if (seen.has(n)) continue; seen.add(n); }
    out.push(n);
  }
  if (sort === 'asc') out.sort((a, b) => a - b);
  if (sort === 'desc') out.sort((a, b) => b - a);
  return out.map((n) => (pad ? String(n).padStart(pad, '0') : String(n)));
}

const defs = {
  'random-number-generator'(root) {
    const min = input({ type: 'number', step: '1', value: '1' });
    const max = input({ type: 'number', step: '1', value: '100' });
    const count = input({ type: 'number', min: 1, max: 1000, step: '1', value: '6' });
    const unique = switchChip({ label: 'No repeats (like lottery balls)' });
    const sortSel = select({ options: [{ v: 'none', t: 'Keep draw order' }, { v: 'asc', t: 'Sort ascending' }, { v: 'desc', t: 'Sort descending' }], value: 'none' });
    const status = statusLine('');
    const grid = statsGrid();
    const out = h('div', { class: 'swatch-row', role: 'list' });
    const gen = () => {
      try {
        const nums = randomNumbers({
          min: Number(min.value), max: Number(max.value),
          count: Math.max(1, Math.min(1000, Math.floor(Number(count.value) || 1))),
          unique: unique.querySelector('input').checked,
          sort: sortSel.value,
        });
        out.replaceChildren(...nums.map((n, i) => h('button', {
          type: 'button', class: 'swatch', role: 'listitem', style: 'width:96px;text-align:center',
          'aria-label': `Copy ${n}`, onclick: async () => { (await copyText(n)) ? toast(`${n} copied`, 'success') : toast('Copy failed', 'error'); },
        },
          h('div', { class: 'sw-color', style: `height:56px;display:grid;place-items:center;font-size:1.25rem;font-weight:800;color:var(--text);background:${['var(--primary-soft)', 'var(--success-soft)', 'var(--warning-soft)'][i % 3]}`, text: n.length > 9 ? n.slice(0, 8) + '…' : n }),
          h('div', { class: 'sw-info', style: 'text-align:center' }, h('span', { class: 'sw-hex', text: `#${i + 1}` })))));
        grid.set([
          { label: 'Range', value: `${min.value}–${max.value}` },
          { label: 'Count', value: String(nums.length) },
          { label: 'Duplicates', value: unique.querySelector('input').checked ? 'excluded' : 'allowed' },
        ]);
        status.set(`${nums.length} number${nums.length === 1 ? '' : 's'} drawn with crypto.getRandomValues ✓`, 'success');
      } catch (e) { out.replaceChildren(); grid.replaceChildren(); status.set(e.message, 'error'); }
    };
    root.append(
      h('div', { class: 'field-row', style: 'align-items:end' },
        field({ label: 'Minimum', control: min }),
        field({ label: 'Maximum', control: max }),
        field({ label: 'How many (1–1000)', control: count }),
        field({ label: 'Order', control: sortSel })),
      h('div', { class: 'switch-row', style: 'margin-bottom:6px' }, unique),
      actionsRow(btn({ label: 'Generate', icon: 'shuffle', onClick: gen })),
      grid, status, h('br'), out,
      privacyNote('Numbers come from your browser’s cryptographic random source — nothing is generated on a server.'));
    gen();
  },
};

defs['dice-roller'] = (root) => {
  const dice = input({ type: 'number', min: 1, max: 12, step: '1', value: '2' });
  const sides = select({ options: [
    { v: 6, t: 'd6 — classic cube' }, { v: 4, t: 'd4' }, { v: 8, t: 'd8' }, { v: 10, t: 'd10' },
    { v: 12, t: 'd12' }, { v: 20, t: 'd20 — twenty-sided' }, { v: 100, t: 'd100' },
  ], value: 6 });
  const status = statusLine('');
  const grid = statsGrid();
  const out = h('div', { class: 'swatch-row', role: 'list' });
  const history = [];
  const roll = () => {
    try {
      const n = Math.max(1, Math.min(12, Math.floor(Number(dice.value) || 1)));
      dice.value = String(n);
      const s = Number(sides.value);
      const rolls = rollDice({ dice: n, sides: s });
      const total = rolls.reduce((a, b) => a + b, 0);
      history.unshift({ rolls, total, s });
      if (history.length > 10) history.pop();
      out.replaceChildren(...rolls.map((r, i) => h('div', {
        class: 'swatch', role: 'listitem', style: 'width:84px;text-align:center;cursor:default',
      },
        h('div', { class: 'sw-color', style: `height:64px;display:grid;place-items:center;font-size:1.7rem;font-weight:800;color:var(--text);background:${r === s ? 'var(--success-soft)' : r === 1 ? 'var(--danger-soft)' : 'var(--primary-soft)'}`, text: String(r) }),
        h('div', { class: 'sw-info', style: 'text-align:center' }, h('span', { class: 'sw-hex', text: `die ${i + 1}` })))));
      grid.set([
        { label: 'Total', value: String(total), kind: 'good' },
        { label: 'Dice', value: `${n}d${s}` },
        { label: 'Average', value: (total / n).toFixed(2) },
        { label: 'Highest possible', value: String(n * s) },
      ]);
      status.set(`Rolled ${n}d${s} → ${rolls.join(' + ')} = ${total}${rolls.some((r) => r === s) ? ' · max roll!' : rolls.some((r) => r === 1) ? ' · critical fail (1)' : ''}`, 'success');
    } catch (e) { status.set(e.message, 'error'); }
  };
  root.append(
    h('div', { class: 'field-row', style: 'align-items:end' },
      field({ label: 'Number of dice (1–12)', control: dice }),
      field({ label: 'Dice type', control: sides }),
      field({ label: ' ', control: btn({ label: 'Roll', icon: 'refresh', onClick: roll }) })),
    grid, status, h('br'), out);
  roll();
};

export function mount(id) { mountTool(id, defs); }
export const __test = { randomNumbers, rollDice };
