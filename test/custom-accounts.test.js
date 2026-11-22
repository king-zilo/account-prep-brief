import test from 'node:test';
import assert from 'node:assert/strict';
import { generateBrief } from '../docs/brief.js';
import { buildAccount, exampleInput, isoDateOffset, parseTickets, validateInput } from '../docs/custom-accounts.js';

const today = new Date('2026-11-22T15:00:00Z');
const example = () => ({ ...exampleInput(today), id: 'custom-1' });
const briefFor = (input, notes = '') => generateBrief(buildAccount(input, today), { notes, today });

test('the example account is valid and starts healthy', () => {
  assert.deepEqual(validateInput(example(), today), {});
  const brief = briefFor(example());
  assert.equal(brief.health.label, 'Healthy');
  assert.ok(brief.opportunities.some((o) => o.title === 'Expansion interest'));
  assert.match(brief.email.to, /^Chris Nguyen/);
});

test('editing the account changes the brief: champion leaves, then bad news in notes', () => {
  const healthy = briefFor(example()).health.score;
  const championLeft = briefFor({ ...example(), championLeft: true });
  assert.ok(championLeft.health.score < healthy);
  assert.ok(championLeft.risks.some((r) => r.title === 'Champion Chris Nguyen has left'));
  assert.match(championLeft.email.to, /^Morgan Blake/, 'email falls back to the economic buyer');

  const withNotes = briefFor({ ...example(), championLeft: true }, 'Morgan said budget is tight and they are evaluating alternatives.');
  assert.ok(withNotes.health.score < championLeft.health.score);
});

test('converts dates, usage, and tickets into the account shape', () => {
  const account = buildAccount(example(), today);
  assert.equal(account.renewalInDays, 60);
  assert.equal(account.contacts[0].lastContactDaysAgo, 10);
  assert.deepEqual(account.usage, [150, 150, 150, 155, 160, 165]);
  assert.equal(account.tickets[0].priority, 'P2');
  assert.equal(account.custom, true);
});

test('a minimal account with only required fields still produces a brief', () => {
  const input = { id: 'custom-2', name: 'Tiny Co', arr: '5000', seats: '10', nps: '9', activeNow: '9', renewalDate: isoDateOffset(200, today) };
  assert.deepEqual(validateInput(input, today), {});
  const brief = briefFor(input);
  assert.ok(brief.health.score >= 0 && brief.health.score <= 100);
  assert.equal(brief.email.to, '');
  assert.match(brief.email.body, /^Hi there,/);
});

test('parses ticket priorities and defaults to P3', () => {
  assert.deepEqual(
    parseTickets('P1: Export broken\np2 - Slow dashboard\nJust a question\n\n').map((t) => [t.priority, t.title]),
    [['P1', 'Export broken'], ['P2', 'Slow dashboard'], ['P3', 'Just a question']],
  );
});

test('validation explains each problem', () => {
  const errors = validateInput({ arr: 'abc', seats: '0', nps: '11', activeNow: '', renewalDate: isoDateOffset(-1, today), lastContactDate: isoDateOffset(3, today), championLeft: true }, today);
  assert.deepEqual(errors, {
    name: 'Enter a company name.',
    arr: 'ARR must be a number.',
    seats: 'Licensed seats must be 1 or more.',
    activeNow: 'Active users this month is required.',
    nps: 'NPS must be between 0 and 10.',
    renewalDate: 'Renewal date must be today or later.',
    lastContactDate: 'Last contact date cannot be in the future.',
    championName: 'Enter the champion who left.',
  });
});
