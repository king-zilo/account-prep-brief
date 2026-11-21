import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { generateBrief } from '../docs/brief.js';
import { createServer } from '../server.js';

const data = JSON.parse(readFileSync(new URL('../docs/data/accounts.json', import.meta.url), 'utf8'));
const account = (id) => structuredClone(data.accounts.find((a) => a.id === id));
const brief = (id, opts = {}) => generateBrief(account(id), { owner: data.owner, vendor: data.vendor, ...opts });

test('sample accounts land in different health levels', () => {
  assert.equal(brief('northwind').health.label, 'At risk');
  assert.equal(brief('brightpath').health.label, 'Healthy');
  assert.equal(brief('summit').health.label, 'Needs attention');
  assert.equal(brief('cobalt').health.label, 'Needs attention');
});

test('flags data-driven risks for an at-risk account', () => {
  const titles = brief('northwind').risks.map((r) => r.title);
  assert.ok(titles.includes('Champion Dana Ortiz has left'));
  assert.ok(titles.some((t) => t.startsWith('Open P1:')));
  assert.ok(titles.some((t) => t.startsWith('Usage down')));
  assert.ok(titles.includes('Competitive threat'), 'picks up "evaluating alternatives" from the email');
  assert.ok(!titles.includes('Stakeholder change'), 'does not double count the departed champion');
});

test('flags expansion and advocacy for a healthy account', () => {
  const titles = brief('brightpath').opportunities.map((o) => o.title);
  assert.ok(titles.includes('Expansion interest'));
  assert.ok(titles.includes('Advocacy potential'));
  assert.ok(titles.some((t) => t.startsWith('Seat utilization')));
});

test('pasted notes add new signals and lower the score', () => {
  const before = brief('summit');
  const after = brief('summit', { notes: 'Laura mentioned a spend freeze. They are evaluating alternatives for next year.' });
  assert.ok(after.health.score < before.health.score);
  const fromNotes = after.risks.filter((r) => r.source === 'Your notes').map((r) => r.title);
  assert.deepEqual(fromNotes.sort(), ['Budget pressure', 'Competitive threat']);
  assert.match(after.risks.find((r) => r.title === 'Budget pressure').detail, /spend freeze/);
});

test('email goes to the active champion, or falls back when the champion left', () => {
  assert.match(brief('brightpath').email.to, /^Tom Reyes/);
  assert.match(brief('brightpath').email.body, /^Hi Tom,/);
  assert.match(brief('northwind').email.to, /^Marcus Webb/, 'falls back to the economic buyer');
  assert.match(brief('northwind').email.body, /SUP-4821/);
});

test('score stays within 0 to 100', () => {
  const worst = brief('northwind', { notes: 'We will cancel. Too expensive, evaluating a competitor, frustrated by the outage.' });
  assert.ok(worst.health.score >= 0 && worst.health.score <= 100);
});

test('markdown export includes every section', () => {
  const md = brief('cobalt').markdown;
  for (const heading of ['## Risks', '## Opportunities', '## Talking points', '## Questions to ask', '## Stakeholders', '## Follow-up email']) {
    assert.ok(md.includes(heading), heading);
  }
});

test('local server serves the static site', async (t) => {
  const server = createServer().listen(0);
  t.after(() => server.close());
  await new Promise((r) => server.once('listening', r));
  const base = `http://localhost:${server.address().port}`;

  assert.equal((await fetch(`${base}/`)).status, 200);
  assert.equal((await fetch(`${base}/brief.js`)).status, 200);
  const list = await (await fetch(`${base}/data/accounts.json`)).json();
  assert.equal(list.accounts.length, 4);
  assert.equal((await fetch(`${base}/missing.js`)).status, 404);
  assert.equal((await fetch(`${base}/..%2Fserver.js`)).status, 403);
});
