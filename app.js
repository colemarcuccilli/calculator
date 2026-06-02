'use strict';

/* =====================================================================
   Sweet Dreams × MC Racing — Revenue Share Calculator
   Marginal bracket model: each tier's percentage applies ONLY to the
   revenue that falls inside that tier (like income-tax brackets).
   ===================================================================== */

// Default schedule — Sweet Dreams' % of Mark's monthly revenue.
// `upTo: null` means the final, open-ended "and up" tier.
const DEFAULT_BRACKETS = [
  { upTo: 3500,  rate: 0  },
  { upTo: 6500,  rate: 10 },
  { upTo: 9000,  rate: 15 },
  { upTo: 12000, rate: 19 },
  { upTo: 14500, rate: 21 },
  { upTo: null,  rate: 25 },
];

const STORAGE_KEY = 'sd-mc-revenue-share-v1';

// ---- State ----
const state = {
  revenue: 10000,
  scenarios: [],
  seq: 1,
};

// ---- Formatting helpers ----
const moneyFmt = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});
function fmtMoney(n) {
  if (!isFinite(n)) return '—';
  return moneyFmt.format(n);
}
function fmtPct(n) {
  const r = Math.round((Number(n) || 0) * 100) / 100;
  return `${r}%`;
}
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function clampNum(v, min, max) {
  let n = parseFloat(String(v).replace(/[^0-9.\-]/g, ''));
  if (!isFinite(n)) n = (min !== undefined ? min : 0);
  if (min !== undefined) n = Math.max(min, n);
  if (max !== undefined) n = Math.min(max, n);
  return n;
}

// ---- Core marginal computation ----
function compute(revenue, brackets) {
  const rev = Math.max(0, Number(revenue) || 0);
  let sdTotal = 0;
  let lower = 0;
  const rows = [];

  for (const b of brackets) {
    const isOpen = (b.upTo === null || b.upTo === undefined || b.upTo === '');
    const upper = isOpen ? Infinity : Number(b.upTo);
    const rate = Number(b.rate) || 0;
    const top = isOpen ? rev : Math.min(rev, upper);
    const amount = Math.max(0, top - lower);
    const sd = amount * (rate / 100);
    rows.push({ lower, upper, rate, amount, sd, mark: amount - sd, active: amount > 0 });
    sdTotal += sd;
    lower = isFinite(upper) ? upper : lower;
  }

  const keep = rev - sdTotal;
  return {
    revenue: rev,
    sdTotal,
    keep,
    rows,
    effRate: rev > 0 ? (sdTotal / rev) * 100 : 0,
    keepRate: rev > 0 ? (keep / rev) * 100 : 0,
  };
}

// ---- Bracket / scenario utilities ----
function cloneBrackets(brackets) {
  return brackets.map((b) => ({ upTo: b.upTo, rate: b.rate }));
}
function sortBracketsKeepingTop(brackets) {
  if (brackets.length <= 1) return brackets;
  const top = brackets[brackets.length - 1]; // open "and up" tier stays last
  const rest = brackets.slice(0, -1);
  rest.sort((a, b) => (Number(a.upTo) || 0) - (Number(b.upTo) || 0));
  return [...rest, top];
}
function getScenario(id) {
  return state.scenarios.find((s) => s.id === id);
}
function uid() {
  return 's' + (state.seq++);
}
function nextScenarioName() {
  return 'Version ' + (state.scenarios.length + 1);
}

function addScenario(brackets, name) {
  state.scenarios.push({ id: uid(), name: name || nextScenarioName(), brackets });
}
function duplicateScenario(id) {
  const scn = getScenario(id);
  if (!scn) return;
  state.scenarios.push({
    id: uid(),
    name: scn.name + ' (copy)',
    brackets: cloneBrackets(scn.brackets),
  });
}
function removeScenario(id) {
  if (state.scenarios.length <= 1) return;
  state.scenarios = state.scenarios.filter((s) => s.id !== id);
}
function addBracket(id) {
  const scn = getScenario(id);
  if (!scn) return;
  const b = scn.brackets;
  const top = b[b.length - 1];
  const lastFinite = b.length >= 2 ? (Number(b[b.length - 2].upTo) || 0) : 0;
  b.splice(b.length - 1, 0, { upTo: lastFinite + 2500, rate: top.rate });
}
function removeBracket(id, index) {
  const scn = getScenario(id);
  if (!scn || scn.brackets.length <= 1) return;
  scn.brackets.splice(index, 1);
  scn.brackets[scn.brackets.length - 1].upTo = null; // keep top tier open
}

// ---- Rendering ----
function renderResults(scn) {
  const r = compute(state.revenue, scn.brackets);
  const active = r.rows.filter((row) => row.active);
  const breakdown = active.map((row) => {
    const range = isFinite(row.upper)
      ? `${fmtMoney(row.lower)} – ${fmtMoney(row.upper)}`
      : `${fmtMoney(row.lower)}+`;
    return `<tr>
        <td class="bd-tier">${range}<span class="bd-rate">${fmtPct(row.rate)}</span></td>
        <td class="bd-sd">${fmtMoney(row.sd)}</td>
        <td class="bd-mark">${fmtMoney(row.mark)}</td>
      </tr>`;
  }).join('');

  return `
    <div class="revenue-total">
      <span class="rt-label">Revenue</span>
      <span class="rt-value">${fmtMoney(r.revenue)}</span>
    </div>
    <div class="result-grid">
      <div class="result sd">
        <span class="result-label">Sweet Dreams</span>
        <span class="result-value">${fmtMoney(r.sdTotal)}</span>
        <span class="result-sub">${fmtPct(r.effRate)} effective</span>
      </div>
      <div class="result keep">
        <span class="result-label">Mark</span>
        <span class="result-value">${fmtMoney(r.keep)}</span>
        <span class="result-sub">${fmtPct(r.keepRate)} of revenue</span>
      </div>
    </div>
    ${active.length ? `<table class="breakdown">
      <thead><tr><th>Bracket</th><th>Sweet Dreams</th><th>Mark</th></tr></thead>
      <tbody>${breakdown}</tbody>
    </table>` : ''}
    <p class="totals-note">Take-home before expenses</p>`;
}

function renderCard(scn) {
  const b = scn.brackets;
  const showRemove = state.scenarios.length > 1;

  const rows = b.map((br, i) => {
    const isOpen = (br.upTo === null || br.upTo === undefined || br.upTo === '');
    const lower = i === 0 ? 0 : (b[i - 1].upTo == null ? 0 : Number(b[i - 1].upTo) || 0);
    const upperCell = isOpen
      ? `<span class="open-top">and up</span>`
      : `<input type="number" class="thresh" min="0" step="100" value="${escapeHtml(br.upTo)}"
            data-id="${scn.id}" data-index="${i}" data-field="upTo" aria-label="Tier upper limit" inputmode="decimal">`;
    return `
      <tr data-id="${scn.id}" data-index="${i}">
        <td class="lower">${fmtMoney(lower)}</td>
        <td class="upper">${upperCell}</td>
        <td class="rate">
          <input type="number" class="rate-input" min="0" max="100" step="1" value="${escapeHtml(br.rate)}"
            data-id="${scn.id}" data-index="${i}" data-field="rate" aria-label="Sweet Dreams percentage" inputmode="decimal"><span class="pct">%</span>
        </td>
        <td class="rm">
          <button class="icon-btn" type="button" data-action="remove-bracket" data-id="${scn.id}" data-index="${i}"
            title="Remove tier" aria-label="Remove tier">✕</button>
        </td>
      </tr>`;
  }).join('');

  return `
    <article class="scenario" data-id="${scn.id}">
      <div class="scenario-head">
        <input class="scenario-name" value="${escapeHtml(scn.name)}" data-id="${scn.id}" data-field="name" aria-label="Scenario name">
        <div class="scenario-actions">
          <button class="btn btn-ghost btn-sm" type="button" data-action="duplicate" data-id="${scn.id}">Duplicate</button>
          ${showRemove ? `<button class="icon-btn danger" type="button" data-action="remove-scenario" data-id="${scn.id}" title="Delete scenario" aria-label="Delete scenario">✕</button>` : ''}
        </div>
      </div>
      <div class="bracket-editor">
        <table class="brackets">
          <thead><tr><th>From</th><th>Up to</th><th>SD&nbsp;%</th><th></th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
        <button class="btn btn-ghost btn-sm add-bracket" type="button" data-action="add-bracket" data-id="${scn.id}">+ Add tier</button>
      </div>
      <div class="totals" data-results-for="${scn.id}">
        ${renderResults(scn)}
      </div>
    </article>`;
}

function renderComparison() {
  const el = document.getElementById('comparison');
  if (state.scenarios.length < 2) {
    el.hidden = true;
    el.innerHTML = '';
    return;
  }
  el.hidden = false;
  const computed = state.scenarios.map((s) => ({ s, r: compute(state.revenue, s.brackets) }));
  const maxKeep = Math.max(...computed.map((c) => c.r.keep));

  const rows = computed.map(({ s, r }) => {
    const best = Math.abs(r.keep - maxKeep) < 0.005;
    return `<tr class="${best ? 'best' : ''}">
        <td>${escapeHtml(s.name)}${best ? '<span class="badge">Best for Mark</span>' : ''}</td>
        <td>${fmtMoney(r.sdTotal)}</td>
        <td>${fmtMoney(r.keep)}</td>
        <td>${fmtPct(r.effRate)}</td>
      </tr>`;
  }).join('');

  el.innerHTML = `
    <h2>Comparison <span class="muted">at ${fmtMoney(state.revenue)} / mo</span></h2>
    <div class="table-wrap">
      <table class="compare-table">
        <thead><tr><th>Scenario</th><th>Sweet Dreams</th><th>Mark</th><th>SD rate</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}

function renderAll() {
  document.getElementById('scenarios').innerHTML = state.scenarios.map(renderCard).join('');
  renderComparison();
}

// Update result panels in place (keeps editor inputs focused while typing).
function updateResultsOnly() {
  for (const s of state.scenarios) {
    const panel = document.querySelector(`[data-results-for="${s.id}"]`);
    if (panel) panel.innerHTML = renderResults(s);
  }
  renderComparison();
}

function rebuildCard(id) {
  const scn = getScenario(id);
  const card = document.querySelector(`.scenario[data-id="${id}"]`);
  if (scn && card) card.outerHTML = renderCard(scn);
}

// ---- Persistence ----
function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      revenue: state.revenue,
      scenarios: state.scenarios,
      seq: state.seq,
    }));
  } catch (e) { /* storage unavailable — ignore */ }
}

function loadState() {
  let loaded = null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) loaded = JSON.parse(raw);
  } catch (e) { /* ignore */ }

  if (loaded && Array.isArray(loaded.scenarios) && loaded.scenarios.length) {
    state.revenue = Number(loaded.revenue) || 0;
    state.scenarios = loaded.scenarios.map((s) => ({
      id: s.id || uid(),
      name: s.name || 'Scenario',
      brackets: (Array.isArray(s.brackets) && s.brackets.length)
        ? s.brackets.map((b) => ({
            upTo: (b.upTo === null || b.upTo === undefined) ? null : Number(b.upTo),
            rate: Number(b.rate) || 0,
          }))
        : cloneBrackets(DEFAULT_BRACKETS),
    }));
    state.seq = Number(loaded.seq) || (state.scenarios.length + 1);
  } else {
    state.revenue = 10000;
    state.scenarios = [];
    state.seq = 1;
    addScenario(cloneBrackets(DEFAULT_BRACKETS), 'Sweet Dreams × MC Racing');
  }
}

// ---- Events ----
function wireEvents() {
  const revenue = document.getElementById('revenue');
  revenue.addEventListener('input', () => {
    state.revenue = clampNum(revenue.value, 0);
    updateResultsOnly();
    save();
  });

  document.getElementById('add-scenario').addEventListener('click', () => {
    addScenario(cloneBrackets(DEFAULT_BRACKETS), nextScenarioName());
    renderAll();
    save();
  });

  document.getElementById('reset').addEventListener('click', () => {
    if (!window.confirm('Reset to a single default scenario? This clears your other scenarios and edits.')) return;
    state.scenarios = [];
    state.seq = 1;
    addScenario(cloneBrackets(DEFAULT_BRACKETS), 'Sweet Dreams × MC Racing');
    renderAll();
    save();
  });

  const container = document.getElementById('scenarios');

  // Live typing in name / rate / threshold fields
  container.addEventListener('input', (e) => {
    const t = e.target;
    const id = t.dataset && t.dataset.id;
    if (!id) return;
    const scn = getScenario(id);
    if (!scn) return;

    if (t.dataset.field === 'name') {
      scn.name = t.value;
      renderComparison();
      save();
      return;
    }

    const index = Number(t.dataset.index);
    if (t.dataset.field === 'rate') {
      scn.brackets[index].rate = clampNum(t.value, 0, 100);
    } else if (t.dataset.field === 'upTo') {
      scn.brackets[index].upTo = (t.value === '') ? scn.brackets[index].upTo : clampNum(t.value, 0);
    }
    const panel = document.querySelector(`[data-results-for="${id}"]`);
    if (panel) panel.innerHTML = renderResults(scn);
    renderComparison();
    save();
  });

  // On blur of a threshold, tidy ordering + refresh "From" column
  container.addEventListener('change', (e) => {
    const t = e.target;
    if (t.dataset && t.dataset.field === 'upTo') {
      const scn = getScenario(t.dataset.id);
      if (!scn) return;
      scn.brackets = sortBracketsKeepingTop(scn.brackets);
      rebuildCard(scn.id);
      renderComparison();
      save();
    }
  });

  // Buttons
  container.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const action = btn.dataset.action;
    const id = btn.dataset.id;

    if (action === 'duplicate') {
      duplicateScenario(id);
      renderAll();
    } else if (action === 'remove-scenario') {
      removeScenario(id);
      renderAll();
    } else if (action === 'add-bracket') {
      addBracket(id);
      rebuildCard(id);
      renderComparison();
    } else if (action === 'remove-bracket') {
      removeBracket(id, Number(btn.dataset.index));
      rebuildCard(id);
      renderComparison();
    }
    save();
  });
}

// ---- Init ----
function init() {
  loadState();
  document.getElementById('revenue').value = state.revenue;
  renderAll();
  wireEvents();
}

if (document.readyState !== 'loading') {
  init();
} else {
  document.addEventListener('DOMContentLoaded', init);
}
