import { generateBrief } from './brief.js';
import { buildAccount, exampleInput, validateInput } from './custom-accounts.js';
import { ENG_SIZES, INDUSTRIES, TRIGGERS, exampleProspect, generatePlan, validateProspect } from './prospect.js';
import { lookupCompany } from './research.js';

const ACCOUNTS_KEY = 'accountPrepBrief.customAccounts';
const PROSPECTS_KEY = 'accountPrepBrief.prospects';
const $ = (id) => document.getElementById(id);
const state = {
  data: null,
  product: null,
  customInputs: [],
  prospects: [],
  selectedId: null,
  editingAccountId: null,
  editingProspectId: null,
  brief: null,
  plan: null,
  notesByAccount: {},
  research: {},
};

const esc = (value) =>
  String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const money = (n) => '$' + Number(n).toLocaleString('en-US');

function toast(message) {
  const el = $('toast');
  el.textContent = message;
  el.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => el.classList.remove('show'), 1800);
}

async function copy(textValue, message) {
  try {
    await navigator.clipboard.writeText(textValue);
    toast(message);
  } catch {
    toast('Copy failed. Select the text and copy manually.');
  }
}

function load(key) {
  try {
    const saved = JSON.parse(localStorage.getItem(key));
    return Array.isArray(saved) ? saved : [];
  } catch {
    return [];
  }
}

function save(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    toast('Could not save in this browser. Your changes stay until you refresh.');
  }
}

function sparkline(values) {
  const w = 120, h = 30, max = Math.max(...values), min = Math.min(...values);
  const span = max - min || 1;
  const points = values.map((v, i) => `${(i / (values.length - 1)) * w},${h - ((v - min) / span) * (h - 4) - 2}`).join(' ');
  const color = values[values.length - 1] >= values[0] ? 'var(--good)' : 'var(--bad)';
  return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" aria-hidden="true"><polyline fill="none" stroke="${color}" stroke-width="2" points="${points}"/></svg>`;
}

function renderList(el, items, render, emptyText) {
  el.innerHTML = items.length ? items.map(render).join('') : `<li class="muted">${esc(emptyText)}</li>`;
}

const link = (url, label) => `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(label)}</a>`;

function showView(view) {
  $('empty').classList.toggle('hidden', view !== 'empty');
  $('brief').classList.toggle('hidden', view !== 'brief');
  $('plan').classList.toggle('hidden', view !== 'plan');
}

function markSelected() {
  document.querySelectorAll('.account-list button[data-id]').forEach((btn) => btn.classList.toggle('active', btn.dataset.id === state.selectedId));
}

/* ---------- Existing customer briefs ---------- */

function renderFinding(f) {
  const isNew = f.source === 'Your notes' ? '<span class="new">from your notes</span>' : '';
  return `<li><div class="title">${esc(f.title)}${isNew}</div><div class="detail">${esc(f.detail)}</div><div class="source">${esc(f.source)}</div></li>`;
}

function renderBrief(b) {
  const a = b.account;
  showView('brief');
  $('b-name').textContent = a.name;
  $('b-meta').textContent = `${a.industry} · ${a.segment} · Brief generated ${b.generatedOn}`;

  const renewalLevel = a.renewalInDays <= 60 ? 'bad' : a.renewalInDays <= 120 ? 'warn' : '';
  const latest = a.usage[a.usage.length - 1];
  $('b-metrics').innerHTML = `
    <div class="metric ${b.health.level}"><div class="label">Health</div><div class="value">${b.health.score}</div><div class="hint">${esc(b.health.label)}</div></div>
    <div class="metric"><div class="label">ARR</div><div class="value">${esc(a.arrFormatted)}</div><div class="hint">${esc(a.plan)} plan</div></div>
    <div class="metric ${renewalLevel}"><div class="label">Renewal</div><div class="value">${a.renewalInDays}d</div><div class="hint">${esc(a.renewalDate)}</div></div>
    <div class="metric"><div class="label">Seats active</div><div class="value">${Math.round((latest / a.seats) * 100)}%</div><div class="hint">${latest} of ${a.seats}</div></div>
    <div class="metric"><div class="label">6-month usage</div>${sparkline(a.usage)}<div class="hint">Monthly active users</div></div>`;

  $('b-risks').className = 'findings risk';
  $('b-opps').className = 'findings opp';
  renderList($('b-risks'), b.risks, renderFinding, 'No risks flagged.');
  renderList($('b-opps'), b.opportunities, renderFinding, 'No opportunities flagged yet.');
  renderList($('b-talking'), b.talkingPoints, (t) => `<li>${esc(t)}</li>`, '');
  renderList($('b-questions'), b.questions, (q) => `<li>${esc(q)}</li>`, 'No specific questions.');

  const sentimentLevel = { positive: 'good', neutral: 'neutral', negative: 'bad' };
  renderList($('b-people'), b.stakeholders, (s) => {
    const badge = s.status === 'left'
      ? '<span class="badge bad">Left company</span>'
      : `<span class="badge ${sentimentLevel[s.sentiment] || 'neutral'}">${esc(s.sentiment)}</span>`;
    const last = s.status === 'left' ? '' : ` · last contact ${s.lastContactDaysAgo}d ago`;
    return `<li><div><div><strong>${esc(s.name)}</strong>, ${esc(s.title)}</div><div class="role">${esc(s.role)}${last}</div></div>${badge}</li>`;
  }, 'No contacts on file.');

  renderList($('b-activity'), b.recentActivity, (item) =>
    `<li><div class="when">${esc(item.date)} · ${esc(item.type)} · ${esc(item.from)}</div><div>${esc(item.summary)}</div></li>`, 'No recent activity.');

  $('e-to').textContent = b.email.to;
  $('e-subject').textContent = b.email.subject;
  $('e-body').value = b.email.body;

  renderList($('b-drivers'), b.health.drivers, (d) =>
    `<li><span>${esc(d.label)}</span><span class="${d.impact >= 0 ? 'pos' : 'neg'}">${d.impact > 0 ? '+' : ''}${d.impact}</span></li>`, 'No adjustments.');

  $('gen-time').textContent = `Brief generated in ${b.generatedInMs} ms`;
}

function allAccounts() {
  return [...state.customInputs.map((input) => buildAccount(input)), ...state.data.accounts];
}

function renderAccountList() {
  $('account-list').innerHTML = allAccounts()
    .map((a) => {
      const { health } = generateBrief(a, { notes: state.notesByAccount[a.id] || '', owner: state.data.owner, vendor: state.data.vendor });
      const tag = a.custom ? '<span class="tag">Added</span>' : '';
      return `<li><button data-id="${esc(a.id)}" data-kind="account"><div><div class="name">${esc(a.name)}${tag}</div><div class="info">${money(a.arr)} ARR · renews in ${a.renewalInDays}d</div></div><span class="badge ${health.level}">${health.score}</span></button></li>`;
    })
    .join('');
  markSelected();
}

function loadBrief(id) {
  const account = allAccounts().find((a) => a.id === id);
  if (!account) return;
  state.selectedId = id;
  markSelected();
  $('notes').value = state.notesByAccount[id] || '';
  const started = performance.now();
  state.brief = generateBrief(account, { notes: $('notes').value, owner: state.data.owner, vendor: state.data.vendor });
  state.brief.generatedInMs = Math.max(1, Math.round(performance.now() - started));
  renderBrief(state.brief);
  $('edit-account').classList.toggle('hidden', !account.custom);
  $('delete-account').classList.toggle('hidden', !account.custom);
}

/* ---------- Greenfield prospect plans ---------- */

function renderResearch(id) {
  const el = $('p-wiki');
  const entry = state.research[id];
  if (!entry || entry.status === 'loading') {
    el.innerHTML = '<div class="muted">Looking up the company on Wikipedia…</div>';
  } else if (entry.status === 'error') {
    el.innerHTML = '<div class="muted">Could not reach Wikipedia. Check your internet connection and click <strong>Look up again</strong>. The research links still work.</div>';
  } else if (!entry.result) {
    el.innerHTML = '<div class="muted">No Wikipedia article matches this company name. That is common for private or smaller companies, so start with the research links.</div>';
  } else {
    const r = entry.result;
    el.innerHTML = `<div class="wiki-title">${esc(r.title)}</div>
      ${r.description ? `<div class="wiki-desc">${esc(r.description)}</div>` : ''}
      <div>${esc(r.extract)}</div>
      <div class="wiki-note">Source: ${link(r.url, 'Wikipedia')}. Best match by name, so confirm it is the right company.</div>`;
  }
}

async function runResearch(prospect, { force = false } = {}) {
  const id = prospect.id;
  if (!force && state.research[id] && state.research[id].status !== 'error') {
    renderResearch(id);
    return;
  }
  state.research[id] = { status: 'loading', name: prospect.name };
  renderResearch(id);
  try {
    const result = await lookupCompany(prospect.name);
    state.research[id] = { status: 'done', name: prospect.name, result };
  } catch {
    state.research[id] = { status: 'error', name: prospect.name };
  }
  if (state.selectedId === id) renderResearch(id);
}

function renderPlan(p) {
  showView('plan');
  const pr = p.prospect;
  $('p-name').innerHTML = `${esc(pr.name)} <span class="tag prospect">Prospect</span>`;
  $('p-meta').innerHTML = [esc(pr.industryLabel), esc(pr.engSizeLabel), pr.domain ? link(`https://${pr.domain}`, pr.domain) : '', `Plan generated ${esc(p.generatedOn)}`].filter(Boolean).join(' · ');

  const known = p.personas.filter((x) => x.contacts.length).length;
  $('p-metrics').innerHTML = `
    <div class="metric ${p.fit.level}"><div class="label">Fit score</div><div class="value">${p.fit.score}</div><div class="hint">${esc(p.fit.tier)}</div></div>
    <div class="metric"><div class="label">Priority</div><div class="value small-value">${esc(p.fit.label)}</div><div class="hint">${esc(p.fit.tier)}</div></div>
    <div class="metric"><div class="label">Engineering team</div><div class="value small-value">${esc(pr.engSizeLabel.replace(' engineers', ''))}</div><div class="hint">engineers</div></div>
    <div class="metric"><div class="label">Triggers</div><div class="value">${pr.triggers.length}</div><div class="hint">${esc(pr.triggers.join(', ') || 'None yet')}</div></div>
    <div class="metric ${known >= 2 ? '' : 'warn'}"><div class="label">Buying committee</div><div class="value">${known} of ${p.personas.length}</div><div class="hint">roles with a name</div></div>`;

  renderList($('p-links'), p.researchLinks, (l) => `<li>${link(l.url, l.label)} <span>· ${esc(l.why)}</span></li>`, '');

  $('p-hyp-title').textContent = `Why they might need ${p.product.product}`;
  const confidence = { Strong: 'good', Moderate: 'warn', Early: 'neutral' };
  renderList($('p-hyp'), p.hypotheses, (h) => `<li>
      <div class="title">${esc(h.name)} <span class="badge ${confidence[h.confidence]}">${esc(h.confidence)}</span></div>
      <div class="detail">${esc(h.value)}</div>
      <ul class="evidence">${h.evidence.map((e) => `<li>${esc(e)}</li>`).join('')}</ul>
    </li>`, '');

  const people = p.personas.map((x) => {
    const names = x.contacts.length
      ? x.contacts.map((c) => `<div><strong>${esc(c.name)}</strong>${c.title ? `, ${esc(c.title)}` : ''}</div>`).join('')
      : `<div class="muted small">Not found yet. ${link(x.searchUrl, `Search LinkedIn for a ${x.search}`)}</div>`;
    const badge = x.contacts.length ? '<span class="badge good">Known</span>' : '<span class="badge neutral">Gap</span>';
    return `<li><div class="persona-head"><div><strong>${esc(x.role)}</strong> <span class="role">· ${esc(x.titles)}</span></div>${badge}</div>
      ${names}<div class="role">${esc(x.why)}${x.priority ? ` <strong>${esc(x.priority)}.</strong>` : ''}</div></li>`;
  });
  if (p.otherContacts.length) {
    people.push(`<li><div class="persona-head"><strong>Other contacts</strong></div>${p.otherContacts.map((c) => `<div>${esc(c.name)}${c.title ? `, ${esc(c.title)}` : ''}</div>`).join('')}</li>`);
  }
  $('p-people').innerHTML = people.join('');

  renderList($('p-questions'), p.questions, (q) => `<li>${esc(q)}</li>`, '');
  renderList($('p-sequence'), p.sequence, (s) =>
    `<li><div class="when">Day ${s.day} · ${esc(s.channel)} · ${esc(s.target)}</div><div>${esc(s.action)}</div></li>`, '');

  $('pe-to').textContent = p.email.to;
  $('pe-subject').textContent = p.email.subject;
  $('pe-body').value = p.email.body;

  $('p-phases').innerHTML = p.plan
    .map((ph) => `<div class="phase"><div class="phase-when">${esc(ph.phase)}</div><div class="phase-title">${esc(ph.title)}</div><ul>${ph.tasks.map((t) => `<li>${esc(t)}</li>`).join('')}</ul></div>`)
    .join('');

  renderList($('p-drivers'), p.fit.drivers, (d) =>
    `<li><span>${esc(d.label)}</span><span class="${d.impact >= 0 ? 'pos' : 'neg'}">${d.impact > 0 ? '+' : ''}${d.impact}</span></li>`, 'No adjustments.');
}

function planFor(input) {
  return generatePlan(input, state.product, { owner: state.data.owner });
}

function renderProspectList() {
  $('prospect-section').classList.toggle('hidden', state.prospects.length === 0);
  $('prospect-list').innerHTML = state.prospects
    .map((input) => {
      const { fit } = planFor(input);
      return `<li><button data-id="${esc(input.id)}" data-kind="prospect"><div><div class="name">${esc(input.name)}</div><div class="info">${esc(fit.tier)} · ${esc(fit.label)}</div></div><span class="badge ${fit.level || 'neutral'}">${fit.score}</span></button></li>`;
    })
    .join('');
  markSelected();
}

function loadPlan(id) {
  const input = state.prospects.find((p) => p.id === id);
  if (!input) return;
  state.selectedId = id;
  markSelected();
  state.plan = planFor(input);
  renderPlan(state.plan);
  const cached = state.research[id];
  runResearch(input, { force: Boolean(cached && cached.name !== input.name) });
}

/* ---------- Shared form helpers ---------- */

function clearErrors(form) {
  form.querySelectorAll('.field-error').forEach((el) => el.remove());
  form.querySelectorAll('[aria-invalid]').forEach((el) => el.removeAttribute('aria-invalid'));
}

function showErrors(form, errors) {
  clearErrors(form);
  for (const [name, message] of Object.entries(errors)) {
    const field = form.elements[name];
    if (!field) continue;
    field.setAttribute('aria-invalid', 'true');
    const error = document.createElement('span');
    error.className = 'field-error';
    error.textContent = message;
    field.closest('label').append(error);
  }
  const first = form.querySelector('[aria-invalid="true"]');
  if (first) first.focus();
}

function fillForm(form, input) {
  for (const field of form.elements) {
    if (!field.name) continue;
    const value = input[field.name];
    if (field.type === 'checkbox') field.checked = Array.isArray(value) ? value.includes(field.value) : Boolean(value);
    else if (field.name in input) field.value = value;
  }
}

/* ---------- Account form ---------- */

const accountForm = $('account-form');

function openAccountForm(editId = null) {
  state.editingAccountId = editId;
  accountForm.reset();
  clearErrors(accountForm);
  const editing = editId && state.customInputs.find((i) => i.id === editId);
  $('dialog-title').textContent = editing ? `Edit ${editing.name}` : 'New account';
  $('save-account').textContent = editing ? 'Save and update brief' : 'Generate brief';
  $('fill-example').classList.toggle('hidden', Boolean(editing));
  if (editing) fillForm(accountForm, editing);
  $('account-dialog').showModal();
  accountForm.elements.name.focus();
}

accountForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const input = Object.fromEntries(new FormData(accountForm));
  input.championLeft = accountForm.elements.championLeft.checked;
  const errors = validateInput(input);
  if (Object.keys(errors).length) {
    showErrors(accountForm, errors);
    return;
  }
  const id = state.editingAccountId || `custom-${Date.now()}`;
  const record = { ...input, id };
  const index = state.customInputs.findIndex((i) => i.id === id);
  if (index >= 0) state.customInputs[index] = record;
  else state.customInputs.unshift(record);
  save(ACCOUNTS_KEY, state.customInputs);
  $('account-dialog').close();
  state.selectedId = id;
  renderAccountList();
  loadBrief(id);
  toast(index >= 0 ? 'Brief updated' : `Brief generated for ${record.name}`);
});

$('new-account').addEventListener('click', () => openAccountForm());
$('edit-account').addEventListener('click', () => state.selectedId && openAccountForm(state.selectedId));
$('cancel-account').addEventListener('click', () => $('account-dialog').close());
$('fill-example').addEventListener('click', () => {
  fillForm(accountForm, exampleInput());
  clearErrors(accountForm);
});
$('delete-account').addEventListener('click', () => {
  const input = state.customInputs.find((i) => i.id === state.selectedId);
  if (!input || !confirm(`Delete ${input.name}? This cannot be undone.`)) return;
  state.customInputs = state.customInputs.filter((i) => i.id !== input.id);
  delete state.notesByAccount[input.id];
  save(ACCOUNTS_KEY, state.customInputs);
  state.selectedId = null;
  showView('empty');
  renderAccountList();
  toast(`${input.name} deleted`);
});

/* ---------- Prospect form ---------- */

const prospectForm = $('prospect-form');

function buildProspectFormOptions() {
  $('prospect-industry').innerHTML = '<option value="">Choose an industry</option>' + INDUSTRIES.map((i) => `<option value="${i.id}">${esc(i.label)}</option>`).join('');
  $('prospect-size').innerHTML = '<option value="">Choose a size</option>' + ENG_SIZES.map((s) => `<option value="${s.id}">${esc(s.label)}</option>`).join('');
  $('prospect-triggers').innerHTML = TRIGGERS.map((t) => `<label><input type="checkbox" name="triggers" value="${t.id}" /> ${esc(t.label)}</label>`).join('');
}

function openProspectForm(editId = null) {
  state.editingProspectId = editId;
  prospectForm.reset();
  clearErrors(prospectForm);
  const editing = editId && state.prospects.find((p) => p.id === editId);
  $('prospect-dialog-title').textContent = editing ? `Edit ${editing.name}` : 'New prospect';
  $('save-prospect').textContent = editing ? 'Save and update plan' : 'Build research and plan';
  $('fill-prospect-example').classList.toggle('hidden', Boolean(editing));
  if (editing) fillForm(prospectForm, editing);
  $('prospect-dialog').showModal();
  prospectForm.elements.name.focus();
}

prospectForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const data = new FormData(prospectForm);
  const input = Object.fromEntries(data);
  input.triggers = data.getAll('triggers');
  const errors = validateProspect(input);
  if (Object.keys(errors).length) {
    showErrors(prospectForm, errors);
    return;
  }
  const id = state.editingProspectId || `prospect-${Date.now()}`;
  const record = { ...input, id };
  const index = state.prospects.findIndex((p) => p.id === id);
  if (index >= 0) state.prospects[index] = record;
  else state.prospects.unshift(record);
  save(PROSPECTS_KEY, state.prospects);
  $('prospect-dialog').close();
  state.selectedId = id;
  renderProspectList();
  loadPlan(id);
  toast(index >= 0 ? 'Plan updated' : `Research and plan ready for ${record.name}`);
});

$('new-prospect').addEventListener('click', () => openProspectForm());
$('edit-prospect').addEventListener('click', () => state.selectedId && openProspectForm(state.selectedId));
$('cancel-prospect').addEventListener('click', () => $('prospect-dialog').close());
$('fill-prospect-example').addEventListener('click', () => {
  fillForm(prospectForm, exampleProspect());
  clearErrors(prospectForm);
});
$('delete-prospect').addEventListener('click', () => {
  const input = state.prospects.find((p) => p.id === state.selectedId);
  if (!input || !confirm(`Delete ${input.name}? This cannot be undone.`)) return;
  state.prospects = state.prospects.filter((p) => p.id !== input.id);
  delete state.research[input.id];
  save(PROSPECTS_KEY, state.prospects);
  state.selectedId = null;
  showView('empty');
  renderProspectList();
  toast(`${input.name} deleted`);
});
$('rerun-research').addEventListener('click', () => {
  const input = state.prospects.find((p) => p.id === state.selectedId);
  if (input) runResearch(input, { force: true });
});
$('copy-plan').addEventListener('click', () => state.plan && copy(state.plan.markdown, 'Plan copied as Markdown'));
$('copy-plan-email').addEventListener('click', () => {
  if (!state.plan) return;
  const { to, subject } = state.plan.email;
  copy(`To: ${to}\nSubject: ${subject}\n\n${$('pe-body').value}`, 'Email copied');
});
$('print-plan').addEventListener('click', () => window.print());

/* ---------- Page setup ---------- */

$('regenerate').addEventListener('click', () => {
  if (!state.selectedId) return;
  state.notesByAccount[state.selectedId] = $('notes').value;
  renderAccountList();
  loadBrief(state.selectedId);
  toast('Brief updated with your notes');
});
$('copy-brief').addEventListener('click', () => state.brief && copy(state.brief.markdown, 'Brief copied as Markdown'));
$('copy-email').addEventListener('click', () => {
  if (!state.brief) return;
  const { to, subject } = state.brief.email;
  copy(`To: ${to}\nSubject: ${subject}\n\n${$('e-body').value}`, 'Email copied');
});
$('print').addEventListener('click', () => window.print());

document.querySelector('.sidebar').addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-id]');
  if (!btn) return;
  if (btn.dataset.kind === 'prospect') loadPlan(btn.dataset.id);
  else loadBrief(btn.dataset.id);
});

async function init() {
  const [accountsRes, productRes] = await Promise.all([fetch('./data/accounts.json'), fetch('./data/product.json')]);
  if (!accountsRes.ok || !productRes.ok) {
    toast('Could not load app data.');
    return;
  }
  state.data = await accountsRes.json();
  state.product = await productRes.json();
  state.customInputs = load(ACCOUNTS_KEY);
  state.prospects = load(PROSPECTS_KEY);
  $('owner').innerHTML = `<strong>${esc(state.data.owner.name)}</strong><br>${esc(state.data.owner.title)}, ${esc(state.data.vendor)}`;
  buildProspectFormOptions();
  renderProspectList();
  renderAccountList();
}

init();
