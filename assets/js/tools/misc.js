// =============================================================================
// iHaveTools — Miscellaneous: random-number-generator, dice-roller,
// spin-wheel, typing-speed-test
// =============================================================================
import { h, field, input, textarea, select, switchChip, segControl, btn, actionsRow, statusLine, statsGrid, toast, copyText, privacyNote, mountTool } from '../ui.js';
import { randomInt } from './security.js';

export function rollDice({ dice = 2, sides = 6 }) {
  if (!(dice >= 1 && dice <= 12)) throw new Error('Roll between 1 and 12 dice.');
  if (!(sides >= 2 && sides <= 100)) throw new Error('Dice need between 2 and 100 sides.');
  return Array.from({ length: dice }, () => 1 + randomInt(sides));
}

export function randomNumbers({ min, max, count, unique = false, sort = 'none', pad = 0 }) {
  if (!Number.isSafeInteger(min) || !Number.isSafeInteger(max)) throw new Error('Minimum and maximum must be safe whole numbers.');
  if (!Number.isInteger(count) || count < 1 || count > 1000) throw new Error('Choose between 1 and 1000 numbers.');
  if (min > max) throw new Error('Minimum must be less than or equal to maximum.');
  const span = max - min + 1;
  if (span > 4294967296) throw new Error('The inclusive range must contain at most 4,294,967,296 numbers.');
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

export function parseWheelEntries(text) {
  const entries = String(text || '').split(/\r?\n/).map((s) => s.trim()).filter(Boolean).slice(0, 100);
  if (entries.length < 2) throw new Error('Add at least two names or options — one per line.');
  return entries;
}

export function shuffleEntries(entries, pick = randomInt) {
  const out = [...entries];
  for (let i = out.length - 1; i > 0; i--) {
    const j = pick(i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function wheelRotationForWinner({ currentRotation = 0, count, winnerIndex, jitter = 0.5, fullSpins = 5 } = {}) {
  if (!Number.isInteger(count) || count < 2) throw new Error('A wheel needs at least two entries.');
  if (!Number.isInteger(winnerIndex) || winnerIndex < 0 || winnerIndex >= count) throw new Error('Winner is outside the wheel entries.');
  const segment = 360 / count;
  const safeJitter = Math.min(1, Math.max(0, Number(jitter) || 0));
  const centreOffset = -(winnerIndex + 0.5) * segment + (safeJitter - 0.5) * segment * 0.55;
  const mod = (n) => ((n % 360) + 360) % 360;
  return currentRotation + fullSpins * 360 + mod(centreOffset - currentRotation);
}

export function typingStats(target, typed, elapsedSeconds) {
  const expected = String(target || '');
  const actual = String(typed || '');
  if (!expected) throw new Error('There is no typing text to score.');
  let correct = 0;
  const compared = Math.min(expected.length, actual.length);
  for (let i = 0; i < compared; i++) if (actual[i] === expected[i]) correct++;
  const incorrect = Math.max(0, actual.length - correct);
  const seconds = Math.max(0.001, Number(elapsedSeconds) || 0);
  const minutes = seconds / 60;
  return {
    correct,
    incorrect,
    typed: actual.length,
    accuracy: actual.length ? correct / actual.length * 100 : 100,
    grossWpm: (actual.length / 5) / minutes,
    netWpm: (correct / 5) / minutes,
    correctCpm: correct / minutes,
    progressPct: Math.min(100, actual.length / expected.length * 100),
    complete: actual.length >= expected.length,
    remaining: Math.max(0, expected.length - actual.length),
  };
}

const TYPING_TEXTS = [
  'The best tools disappear into the task. A clear screen, a quick answer, and honest feedback help people finish small jobs without learning complicated software or handing private files to a remote server.',
  'Good study habits are built in short, regular sessions. Read actively, test yourself from memory, fix one weak topic at a time, and keep a small record of progress so effort turns into visible momentum.',
  'Morning rain washed the city streets while buses, bicycles, and tea stalls returned to their usual rhythm. Office workers hurried under bright umbrellas, watching the clouds as the first trains rolled into the station.',
  'A healthy garden begins with patient observation. Sunlight, water, soil, and spacing matter more than expensive equipment, and every season teaches the gardener which plants reward care with steady, generous growth.',
  'Strong teams write decisions down, share progress early, and make ownership clear. Small updates prevent large surprises, while respectful questions often reveal a simpler path before work becomes expensive to change.',
  'Accurate typing is a rhythm skill before it becomes a speed skill. Keep your eyes on the words ahead, relax your shoulders, strike each key cleanly, and let faster results arrive through calm repetition.',
];

const escXml = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]));

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

  'spin-wheel'(root) {
    const entriesBox = textarea({ rows: 9, value: 'Aarav\nPriya\nRohan\nSneha\nKabir\nAnaya', spellcheck: 'false' });
    const status = statusLine('Add one name or option per line, then spin. The winner is chosen with crypto.getRandomValues before the wheel animates.');
    const winnerBox = h('div', { class: 'result-panel', style: 'display:none;text-align:center;margin-top:14px', 'aria-live': 'polite' });
    const historyBox = h('div', { style: 'margin-top:12px' });
    const wheelHost = h('div', { style: 'position:relative;width:min(460px,92vw);margin:18px auto 4px;aspect-ratio:1' },
      h('div', { style: 'position:absolute;left:50%;top:-4px;transform:translateX(-50%);width:0;height:0;border-left:13px solid transparent;border-right:13px solid transparent;border-top:24px solid var(--danger);z-index:2;filter:drop-shadow(0 2px 2px rgba(0,0,0,.25))', 'aria-hidden': 'true' }));
    const svgHost = h('div', {});
    wheelHost.append(svgHost);
    const colors = ['#6366f1', '#06b6d4', '#22c55e', '#eab308', '#f97316', '#ec4899', '#8b5cf6', '#14b8a6', '#3b82f6', '#ef4444', '#84cc16', '#f59e0b'];
    let rotation = 0;
    let spinning = false;
    let lastWinner = '';
    const history = [];
    const removeWinnerBtn = btn({ label: 'Remove winner', variant: 'secondary', icon: 'x', onClick: () => {
      if (!lastWinner) return;
      const entries = parseWheelEntries(entriesBox.value);
      const at = entries.indexOf(lastWinner);
      if (at >= 0) entries.splice(at, 1);
      entriesBox.value = entries.join('\n');
      status.set(entries.length >= 2 ? `${lastWinner} removed. ${entries.length} entries remain.` : 'Only one entry remains — add at least one more before spinning again.', entries.length >= 2 ? 'success' : 'warning');
      lastWinner = '';
      removeWinnerBtn.disabled = true;
      render();
    } });
    removeWinnerBtn.disabled = true;

    const point = (r, deg) => {
      const rad = deg * Math.PI / 180;
      return [180 + r * Math.cos(rad), 180 + r * Math.sin(rad)];
    };
    const render = (atRotation = rotation) => {
      let entries;
      try { entries = parseWheelEntries(entriesBox.value); }
      catch {
        svgHost.innerHTML = '<div class="result-panel" style="text-align:center">Add at least two entries to build the wheel.</div>';
        return null;
      }
      const seg = 360 / entries.length;
      const slices = entries.map((entry, i) => {
        const a1 = -90 + i * seg;
        const a2 = a1 + seg;
        const [x1, y1] = point(176, a1);
        const [x2, y2] = point(176, a2);
        const mid = a1 + seg / 2;
        const [tx, ty] = point(112, mid);
        const label = entry.length > 16 ? `${entry.slice(0, 15)}…` : entry;
        return `<path d="M180 180 L${x1.toFixed(2)} ${y1.toFixed(2)} A176 176 0 ${seg > 180 ? 1 : 0} 1 ${x2.toFixed(2)} ${y2.toFixed(2)} Z" fill="${colors[i % colors.length]}" stroke="#fff" stroke-width="2"/><text x="${tx.toFixed(2)}" y="${ty.toFixed(2)}" transform="rotate(${(mid + 90).toFixed(2)} ${tx.toFixed(2)} ${ty.toFixed(2)})" text-anchor="middle" dominant-baseline="middle" fill="#fff" font-size="${entries.length > 18 ? 11 : entries.length > 10 ? 13 : 15}" font-weight="700">${escXml(label)}</text>`;
      }).join('');
      svgHost.innerHTML = `<svg viewBox="0 0 360 360" role="img" aria-label="Prize wheel with ${entries.length} entries" style="display:block;width:100%;height:auto"><circle cx="180" cy="180" r="178" fill="var(--surface-2)"/><g data-wheel-group style="transform:rotate(${atRotation}deg);transform-origin:180px 180px">${slices}<circle cx="180" cy="180" r="34" fill="var(--surface)" stroke="rgba(0,0,0,.18)" stroke-width="2"/><text x="180" y="180" text-anchor="middle" dominant-baseline="middle" fill="var(--text)" font-size="17" font-weight="800">SPIN</text></g></svg>`;
      return entries;
    };
    const paintHistory = () => {
      historyBox.replaceChildren(...(history.length ? [
        h('h3', { text: 'Winner history', style: 'margin:12px 0 6px' }),
        h('p', { class: 'hint', text: history.map((w, i) => `${i + 1}. ${w}`).join('  ·  ') }),
      ] : []));
    };
    const spin = () => {
      if (spinning) return;
      let entries;
      try { entries = parseWheelEntries(entriesBox.value); }
      catch (e) { status.set(e.message, 'error'); render(); return; }
      spinning = true;
      winnerBox.style.display = 'none';
      removeWinnerBtn.disabled = true;
      const winnerIndex = randomInt(entries.length);
      const finalRotation = wheelRotationForWinner({
        currentRotation: rotation, count: entries.length, winnerIndex,
        jitter: randomInt(1000) / 1000, fullSpins: 5,
      });
      render(rotation);
      const group = svgHost.querySelector('[data-wheel-group]');
      const raf = globalThis.requestAnimationFrame || ((fn) => setTimeout(fn, 0));
      raf(() => {
        if (group) {
          group.style.transition = 'transform 4.2s cubic-bezier(0.12, 0.8, 0.08, 1)';
          group.style.transform = `rotate(${finalRotation}deg)`;
        }
      });
      rotation = finalRotation;
      status.set('Wheel spinning…', 'warning');
      setTimeout(() => {
        spinning = false;
        lastWinner = entries[winnerIndex];
        history.unshift(lastWinner);
        if (history.length > 20) history.pop();
        winnerBox.replaceChildren(
          h('div', { class: 'hint', text: 'Winner' }),
          h('div', { style: 'font-size:1.7rem;font-weight:900;color:var(--success)', text: lastWinner }));
        winnerBox.style.display = 'block';
        removeWinnerBtn.disabled = entries.length <= 2;
        paintHistory();
        status.set(`${lastWinner} wins. Spin again or remove the winner for an elimination draw.`, 'success');
      }, 4350);
    };
    entriesBox.addEventListener('input', () => { if (!spinning) render(); });
    root.append(
      field({ label: 'Names or options (one per line, up to 100)', control: entriesBox }),
      actionsRow(
        btn({ label: 'Spin the wheel', icon: 'refresh', onClick: spin }),
        btn({ label: 'Shuffle entries', variant: 'secondary', icon: 'shuffle', onClick: () => { try { entriesBox.value = shuffleEntries(parseWheelEntries(entriesBox.value)).join('\n'); render(); status.set('Entries shuffled ✓', 'success'); } catch (e) { status.set(e.message, 'error'); } } }),
        btn({ label: 'Sort A–Z', variant: 'secondary', icon: 'table', onClick: () => { try { entriesBox.value = parseWheelEntries(entriesBox.value).sort((a, b) => a.localeCompare(b)).join('\n'); render(); } catch (e) { status.set(e.message, 'error'); } } }),
        removeWinnerBtn),
      wheelHost, winnerBox, status, historyBox,
      privacyNote('Names stay in this tab. Nothing is saved or sent to a server, so the same list will not follow you to another device.'));
    render();
  },

  'typing-speed-test'(root) {
    const duration = segControl({ options: [{ v: '30', t: '30 seconds' }, { v: '60', t: '1 minute' }, { v: '120', t: '2 minutes' }], value: '60', ariaLabel: 'Test duration' });
    const targetBox = h('div', { style: 'font-size:1.13rem;line-height:1.9;padding:16px;border:1px solid var(--border);border-radius:12px;background:var(--surface-2);white-space:pre-wrap;margin:14px 0', 'aria-label': 'Text to type' });
    const typed = textarea({ rows: 5, placeholder: 'Click here and start typing the text above…', spellcheck: 'false', autocomplete: 'off', autocapitalize: 'none' });
    typed.addEventListener('paste', (e) => e.preventDefault());
    const grid = statsGrid();
    const status = statusLine('The timer starts with your first character. Paste is disabled so the score stays honest.');
    let passageIndex = 0;
    let target = TYPING_TEXTS[passageIndex];
    let startedAt = null;
    let timer = null;
    let finished = false;
    const secondsAllowed = () => Number(duration.getValue());
    const targetForDuration = () => {
      // Enough text for roughly an 84 WPM typist, so longer tests do not
      // run out of words before the clock does.
      const neededChars = secondsAllowed() * 7;
      let text = '';
      let offset = 0;
      while (text.length < neededChars) {
        text += `${text ? ' ' : ''}${TYPING_TEXTS[(passageIndex + offset) % TYPING_TEXTS.length]}`;
        offset++;
      }
      return text;
    };
    const elapsed = () => startedAt ? Math.min(secondsAllowed(), (Date.now() - startedAt) / 1000) : 0;
    const renderTarget = () => {
      const typedText = typed.value;
      targetBox.replaceChildren(...[...target].map((ch, i) => {
        let style = 'color:var(--text-muted);border-radius:3px;padding:0 0.5px';
        if (i < typedText.length) style = typedText[i] === ch ? 'color:var(--success);font-weight:650;border-radius:3px;padding:0 0.5px' : 'color:var(--danger);background:var(--danger-soft);text-decoration:underline;border-radius:3px;padding:0 0.5px';
        else if (i === typedText.length && !finished) style += ';background:var(--primary-soft);box-shadow:inset 0 -2px var(--primary)';
        return h('span', { style, text: ch });
      }));
    };
    const paint = (atSeconds = elapsed()) => {
      const r = typingStats(target, typed.value, Math.max(0.001, atSeconds));
      grid.set([
        { label: 'Time left', value: `${Math.max(0, Math.ceil(secondsAllowed() - atSeconds))}s` },
        { label: 'Net WPM', value: typed.value ? String(Math.round(r.netWpm)) : '0', kind: 'good' },
        { label: 'Gross WPM', value: typed.value ? String(Math.round(r.grossWpm)) : '0' },
        { label: 'Accuracy', value: `${r.accuracy.toFixed(1)}%`, kind: r.accuracy >= 95 ? 'good' : 'warn' },
        { label: 'Correct characters', value: String(r.correct) },
        { label: 'Progress', value: `${r.progressPct.toFixed(0)}%` },
      ]);
      renderTarget();
      return r;
    };
    const finish = (reason) => {
      if (finished) return;
      finished = true;
      if (timer) clearInterval(timer);
      timer = null;
      typed.disabled = true;
      const r = paint(reason === 'time' ? secondsAllowed() : elapsed());
      status.set(`${reason === 'time' ? 'Time is up.' : 'Text complete.'} Final score: ${Math.round(r.netWpm)} net WPM, ${Math.round(r.grossWpm)} gross WPM and ${r.accuracy.toFixed(1)}% accuracy.`, 'success');
    };
    const tick = () => { if (elapsed() >= secondsAllowed()) finish('time'); else paint(); };
    typed.addEventListener('input', () => {
      if (finished) return;
      if (typed.value.length > target.length) typed.value = typed.value.slice(0, target.length);
      if (!startedAt && typed.value) {
        startedAt = Date.now();
        timer = setInterval(tick, 200);
      }
      const r = paint();
      if (r.complete) finish('complete');
    });
    const reset = (newText) => {
      if (timer) clearInterval(timer);
      timer = null;
      startedAt = null;
      finished = false;
      if (newText) {
        let next = randomInt(TYPING_TEXTS.length);
        if (next === passageIndex) next = (next + 1) % TYPING_TEXTS.length;
        passageIndex = next;
      }
      target = targetForDuration();
      typed.value = '';
      typed.disabled = false;
      paint(0);
      status.set('The timer starts with your first character. Paste is disabled so the score stays honest.', 'warning');
      typed.focus();
    };
    duration.addEventListener('change', () => reset(false));
    root.append(
      field({ label: 'Test duration', control: duration }),
      targetBox,
      field({ label: 'Type here', control: typed }),
      actionsRow(
        btn({ label: 'New text', variant: 'secondary', icon: 'refresh', onClick: () => reset(true) }),
        btn({ label: 'Restart', variant: 'secondary', icon: 'x', onClick: () => reset(false) })),
      grid, status,
      privacyNote('Scoring uses the standard five characters per word. Net WPM counts only correct characters; nothing you type leaves this tab.'));
    target = targetForDuration();
    paint(0);
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
export const __test = { randomNumbers, rollDice, parseWheelEntries, shuffleEntries, wheelRotationForWinner, typingStats, TYPING_TEXTS };
