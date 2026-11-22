import { generateBrief } from './brief.js';
import { buildAccount, exampleInput, validateInput } from './custom-accounts.js';

const STORAGE_KEY = 'accountPrepBrief.customAccounts';
const $ = (id) => document.getElementById(id);
const state = { data: null, customInputs: [], accountId: null, editingId: null, brief: null, notesByAccount: {} };

const esc = (value) =>
  String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const money = (n) => '$' + Number(n).toLocaleString('en-US');

function toast(message) {
  const el = $('toast');
  el.textContent = message;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 1600);
}

async function copy(textValue, message) {
  try {
    await navigator.clipboard.writeText(textValue);
    toast(message);
  } catch {
    toast('Copy failed. Select the text and copy manually.');
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

function renderFinding(f) {
  const isNew = f.source === 'Your notes' ? '<span class="new">from your notes</span>' : '';
  return `<li><div class="title">${esc(f.title)}${isNew}</div><div class="detail">${esc(f.detail)}</div><div class="source">${esc(f.source)}</div></li>`;
}

function renderBrief(b) {
  const a = b.account;
  $('empty').classList.add('hidden');
  $('brief').classList.remove('hidden');
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

function savedInputs() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return Array.isArray(saved) ? saved : [];
  } catch {
    return [];
  }
}

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.customInputs));
  } catch {
    toast('Could not save in this browser. The account stays until you refresh.');
  }
}

function allAccounts() {
  return [...state.customInputs.map((input) => buildAccount(input)), ...state.data.accounts];
}

const findInput = (id) => state.customInputs.find((i) => i.id === id);

function renderSidebar() {
  $('account-list').innerHTML = allAccounts()
    .map((a) => {
      const { health } = generateBrief(a, { notes: state.notesByAccount[a.id] || '', owner: state.data.owner, vendor: state.data.vendor });
      const tag = a.custom ? '<span class="tag">Added</span>' : '';
      return `<li><button data-id="${esc(a.id)}" class="${a.id === state.accountId ? 'active' : ''}"><div><div class="name">${esc(a.name)}${tag}</div><div class="info">${money(a.arr)} ARR · renews in ${a.renewalInDays}d</div></div><span class="badge ${health.level}">${health.score}</span></button></li>`;
    })
    .join('');
}

function loadBrief(id) {
  const account = allAccounts().find((a) => a.id === id);
  if (!account) return;
  state.accountId = id;
  document.querySelectorAll('.account-list button').forEach((btn) => btn.classList.toggle('active', btn.dataset.id === id));
  $('notes').value = state.notesByAccount[id] || '';
  const started = performance.now();
  state.brief = generateBrief(account, { notes: $('notes').value, owner: state.data.owner, vendor: state.data.vendor });
  state.brief.generatedInMs = Math.max(1, Math.round(performance.now() - started));
  renderBrief(state.brief);
  $('edit-account').classList.toggle('hidden', !account.custom);
  $('delete-account').classList.toggle('hidden', !account.custom);
}

function showEmpty() {
  state.accountId = null;
  state.brief = null;
  $('brief').classList.add('hidden');
  $('empty').classList.remove('hidden');
}

const form = $('account-form');

function clearErrors() {
  form.querySelectorAll('.field-error').forEach((el) => el.remove());
  form.querySelectorAll('[aria-invalid]').forEach((el) => el.removeAttribute('aria-invalid'));
}

function showErrors(errors) {
  clearErrors();
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

function fillForm(input) {
  for (const field of form.elements) {
    if (!field.name) continue;
    if (field.type === 'checkbox') field.checked = Boolean(input[field.name]);
    else if (field.name in input) field.value = input[field.name];
  }
}

function readForm() {
  const input = Object.fromEntries(new FormData(form));
  input.championLeft = form.elements.championLeft.checked;
  return input;
}

function openForm(editId = null) {
  state.editingId = editId;
  form.reset();
  clearErrors();
  const editing = editId && findInput(editId);
  $('dialog-title').textContent = editing ? `Edit ${editing.name}` : 'New account';
  $('save-account').textContent = editing ? 'Save and update brief' : 'Generate brief';
  $('fill-example').classList.toggle('hidden', Boolean(editing));
  if (editing) fillForm(editing);
  $('account-dialog').showModal();
  form.elements.name.focus();
}

form.addEventListener('submit', (e) => {
  e.preventDefault();
  const input = readForm();
  const errors = validateInput(input);
  if (Object.keys(errors).length) {
    showErrors(errors);
    return;
  }
  const id = state.editingId || `custom-${Date.now()}`;
  const record = { ...input, id };
  const index = state.customInputs.findIndex((i) => i.id === id);
  if (index >= 0) state.customInputs[index] = record;
  else state.customInputs.unshift(record);
  persist();
  $('account-dialog').close();
  state.accountId = id;
  renderSidebar();
  loadBrief(id);
  toast(index >= 0 ? 'Brief updated' : `Brief generated for ${record.name}`);
});

$('new-account').addEventListener('click', () => openForm());
$('edit-account').addEventListener('click', () => state.accountId && openForm(state.accountId));
$('cancel-account').addEventListener('click', () => $('account-dialog').close());
$('fill-example').addEventListener('click', () => {
  fillForm(exampleInput());
  clearErrors();
});
$('delete-account').addEventListener('click', () => {
  const input = findInput(state.accountId);
  if (!input || !confirm(`Delete ${input.name}? This cannot be undone.`)) return;
  state.customInputs = state.customInputs.filter((i) => i.id !== input.id);
  delete state.notesByAccount[input.id];
  persist();
  showEmpty();
  renderSidebar();
  toast(`${input.name} deleted`);
});

async function init() {
  const res = await fetch('./data/accounts.json');
  if (!res.ok) {
    toast('Could not load account data.');
    return;
  }
  const data = (state.data = await res.json());
  state.customInputs = savedInputs();
  $('owner').innerHTML = `<strong>${esc(data.owner.name)}</strong><br>${esc(data.owner.title)}, ${esc(data.vendor)}`;
  renderSidebar();
  $('account-list').addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-id]');
    if (btn) loadBrief(btn.dataset.id);
  });
}

$('regenerate').addEventListener('click', () => {
  if (!state.accountId) return;
  state.notesByAccount[state.accountId] = $('notes').value;
  renderSidebar();
  loadBrief(state.accountId);
  toast('Brief updated with your notes');
});
$('copy-brief').addEventListener('click', () => state.brief && copy(state.brief.markdown, 'Brief copied as Markdown'));
$('copy-email').addEventListener('click', () => {
  if (!state.brief) return;
  const { to, subject } = state.brief.email;
  copy(`To: ${to}\nSubject: ${subject}\n\n${$('e-body').value}`, 'Email copied');
});
$('print').addEventListener('click', () => window.print());

init();
