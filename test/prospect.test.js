import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { exampleProspect, generatePlan, normalizeDomain, parseContacts, validateProspect } from '../docs/prospect.js';
import { lookupCompany, titleMatches } from '../docs/research.js';

const product = JSON.parse(readFileSync(new URL('../docs/data/product.json', import.meta.url), 'utf8'));
const owner = { name: 'Jordan Lee', title: 'Account Executive' };
const example = () => ({ ...exampleProspect(), id: 'prospect-1' });
const planFor = (input) => generatePlan(input, product, { owner });

test('the example prospect is valid and lands in Tier 1 with migration as the lead hypothesis', () => {
  assert.deepEqual(validateProspect(example()), {});
  const plan = planFor(example());
  assert.equal(plan.fit.tier, 'Tier 1');
  assert.equal(plan.hypotheses[0].name, 'Migrations and modernization');
  assert.equal(plan.hypotheses[0].confidence, 'Strong');
  assert.ok(plan.hypotheses[0].evidence.some((e) => e.includes('legacy monolith')));
});

test('adding a contact and a trigger raises the fit score', () => {
  const before = planFor(example()).fit.score;
  const withBuyer = planFor({ ...example(), contacts: `${example().contacts}\nPriya Raman, VP Engineering` });
  assert.ok(withBuyer.fit.score > before);
  const withTrigger = planFor({ ...example(), contacts: `${example().contacts}\nPriya Raman, VP Engineering`, triggers: ['migration', 'ai'] });
  assert.ok(withTrigger.fit.score > withBuyer.fit.score);
  assert.ok(withTrigger.hypotheses.some((h) => h.name === 'Secure, governed AI adoption'));
});

test('maps known contacts to buying committee roles by title', () => {
  const plan = planFor({ ...example(), contacts: 'Marcus Hill, Director of Platform Engineering\nPriya Raman, VP Engineering\nSam Ito, Principal Engineer\nAlex Wu, CISO\nJo Park, Recruiter' });
  const roles = Object.fromEntries(plan.personas.map((p) => [p.role, p.contacts.map((c) => c.name)]));
  assert.deepEqual(roles, { Champion: ['Marcus Hill'], 'Economic buyer': ['Priya Raman'], 'Security reviewer': ['Alex Wu'], 'Technical evaluator': ['Sam Ito'] });
  assert.deepEqual(plan.otherContacts.map((c) => c.name), ['Jo Park']);
});

test('regulated industries bring security in early', () => {
  const plan = planFor(example());
  assert.equal(plan.personas.find((p) => p.role === 'Security reviewer').priority, 'Bring in early: regulated industry');
  assert.ok(plan.sequence.some((s) => s.target.startsWith('a security reviewer')));
  assert.ok(plan.plan[1].tasks.some((t) => t.startsWith('Start the security review now')));
  const software = planFor({ ...example(), industry: 'software' });
  assert.ok(!software.sequence.some((s) => s.target.startsWith('a security reviewer')));
});

test('the first email goes to the champion and opens with a hook that matches the lead hypothesis', () => {
  const plan = planFor({ ...example(), triggers: ['ai', 'migration'] });
  assert.match(plan.email.to, /^Marcus Hill/);
  assert.match(plan.email.body, /^Hi Marcus,\n\nIt looks like Harborline Financial has a modernization effort underway\./);
  assert.match(plan.email.body, /Account Executive, Factory$/);
});

test('a bare-minimum prospect still gets a complete plan', () => {
  const plan = planFor({ id: 'p2', name: 'Tiny Startup', industry: 'software', engSize: 'xs' });
  assert.equal(plan.fit.tier, 'Tier 3');
  assert.equal(plan.hypotheses.length, 1);
  assert.match(plan.email.body, /^Hi \[first name\],/);
  assert.equal(plan.plan.length, 3);
  assert.ok(plan.personas.every((p) => p.searchUrl.startsWith('https://www.linkedin.com/')));
  for (const heading of ['## Why they might need Droids', '## Who to target', '## Outreach sequence', '## 30/60/90-day plan', '## Research links']) {
    assert.ok(plan.markdown.includes(heading), heading);
  }
});

test('validation and parsing', () => {
  assert.deepEqual(validateProspect({ website: 'not a site' }), {
    name: 'Enter a company name.',
    industry: 'Choose an industry.',
    engSize: 'Choose the engineering team size.',
    website: 'Enter a website like example.com.',
  });
  assert.equal(normalizeDomain('https://www.Example.com/about'), 'example.com');
  assert.deepEqual(parseContacts('Ann Lee, VP, Engineering\nBob\n'), [{ name: 'Ann Lee', title: 'VP, Engineering' }, { name: 'Bob', title: '' }]);
});

test('company name matching rejects loosely related Wikipedia results', () => {
  assert.ok(titleMatches('Capital One', 'Capital One'));
  assert.ok(titleMatches('Stripe', 'Stripe, LLC'));
  assert.ok(titleMatches('Shopify Inc.', 'Shopify'));
  assert.ok(!titleMatches('Acme Robotics', 'Mech-Mind Robotics'));
  assert.ok(titleMatches('Capital One', 'Capital One Arena'), 'extra words are allowed; lookupCompany prefers the closest title');
});

function fakeFetch(routes) {
  return async (url) => {
    const route = routes.find(([pattern]) => url.includes(pattern));
    if (!route) return { ok: false, status: 404, json: async () => ({}) };
    return { ok: true, status: 200, json: async () => route[1] };
  };
}

test('lookupCompany returns the first matching article summary', async () => {
  const fetchImpl = fakeFetch([
    ['list=search', { query: { search: [{ title: 'Red Stripe' }, { title: 'Stripe, LLC' }] } }],
    ['page/summary/Stripe%2C_LLC', { type: 'standard', title: 'Stripe, LLC', description: 'Payments company', extract: 'Stripe is a payments company.', content_urls: { desktop: { page: 'https://en.wikipedia.org/wiki/Stripe,_LLC' } } }],
  ]);
  const result = await lookupCompany('Stripe', fetchImpl);
  assert.equal(result.title, 'Stripe, LLC');
  assert.equal(result.url, 'https://en.wikipedia.org/wiki/Stripe,_LLC');
});

test('lookupCompany returns null when nothing matches and throws when Wikipedia is unreachable', async () => {
  assert.equal(await lookupCompany('Acme Robotics', fakeFetch([['list=search', { query: { search: [{ title: 'Mech-Mind Robotics' }] } }]])), null);
  await assert.rejects(lookupCompany('Stripe', fakeFetch([])), /search failed/);
});
