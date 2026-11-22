const DAY_MS = 24 * 60 * 60 * 1000;

const startOfUtcDay = (date) => Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());

export function isoDateOffset(days, today = new Date()) {
  return new Date(startOfUtcDay(today) + days * DAY_MS).toISOString().slice(0, 10);
}

function daysFromToday(isoDate, today) {
  return Math.round((Date.parse(`${isoDate}T00:00:00Z`) - startOfUtcDay(today)) / DAY_MS);
}

const isBlank = (value) => String(value ?? '').trim() === '';
const clean = (value) => String(value ?? '').trim();

export function exampleInput(today = new Date()) {
  return {
    name: 'Acme Robotics',
    industry: 'Manufacturing',
    segment: 'Mid-Market',
    plan: 'Business',
    goal: 'Reduce production line downtime by 20%',
    arr: '96000',
    renewalDate: isoDateOffset(60, today),
    seats: '200',
    nps: '8',
    activeNow: '165',
    activeBefore: '150',
    championName: 'Chris Nguyen',
    championTitle: 'Head of Engineering Operations',
    championLeft: false,
    buyerName: 'Morgan Blake',
    buyerTitle: 'CFO',
    lastContactDate: isoDateOffset(-10, today),
    sentiment: 'positive',
    tickets: 'P2: Downtime alerts arriving late',
    recentActivity: 'Chris said the plant team loves the new dashboards and wants to roll out to another plant next quarter.',
  };
}

export function validateInput(input, today = new Date()) {
  const errors = {};
  if (isBlank(input.name)) errors.name = 'Enter a company name.';

  const number = (key, label, { min = 0, max = Infinity, required = true } = {}) => {
    if (isBlank(input[key])) {
      if (required) errors[key] = `${label} is required.`;
      return;
    }
    const n = Number(input[key]);
    if (!Number.isFinite(n)) {
      errors[key] = `${label} must be a number.`;
    } else if (n < min || n > max) {
      errors[key] = max === Infinity ? `${label} must be ${min} or more.` : `${label} must be between ${min} and ${max}.`;
    }
  };
  number('arr', 'ARR');
  number('seats', 'Licensed seats', { min: 1 });
  number('activeNow', 'Active users this month');
  number('activeBefore', 'Active users 3 months ago', { required: false });
  number('nps', 'NPS', { max: 10 });

  if (isBlank(input.renewalDate) || Number.isNaN(Date.parse(input.renewalDate))) {
    errors.renewalDate = 'Pick a renewal date.';
  } else if (daysFromToday(input.renewalDate, today) < 0) {
    errors.renewalDate = 'Renewal date must be today or later.';
  }
  if (!isBlank(input.lastContactDate) && daysFromToday(input.lastContactDate, today) > 0) {
    errors.lastContactDate = 'Last contact date cannot be in the future.';
  }
  if (input.championLeft && isBlank(input.championName)) {
    errors.championName = 'Enter the champion who left.';
  }
  return errors;
}

export function parseTickets(text = '') {
  return String(text)
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, i) => {
      const match = line.match(/^(P[1-3])\b\s*[:\-–]?\s*(.*)$/i);
      return {
        id: `T-${i + 1}`,
        title: (match && match[2].trim()) || line,
        priority: match ? match[1].toUpperCase() : 'P3',
        status: 'open',
      };
    });
}

export function buildAccount(input, today = new Date()) {
  const num = (value, fallback = 0) => (isBlank(value) ? fallback : Number(value));
  const now = num(input.activeNow);
  const before = num(input.activeBefore, now);
  const step = (now - before) / 3;
  // brief.js measures the trend from the 4th-to-last month, so the "3 months ago" value sits at index 2.
  const usage = [before, before, before, before + step, before + 2 * step, now].map(Math.round);

  const lastContactDaysAgo = isBlank(input.lastContactDate) ? 0 : Math.max(0, -daysFromToday(input.lastContactDate, today));
  const sentiment = input.sentiment || 'neutral';
  const contacts = [];
  if (!isBlank(input.championName)) {
    contacts.push({
      name: clean(input.championName),
      title: clean(input.championTitle) || 'Champion',
      role: 'Champion',
      sentiment,
      lastContactDaysAgo,
      ...(input.championLeft ? { status: 'left' } : {}),
    });
  }
  if (!isBlank(input.buyerName)) {
    contacts.push({ name: clean(input.buyerName), title: clean(input.buyerTitle) || 'Economic buyer', role: 'Economic buyer', sentiment, lastContactDaysAgo });
  }

  const activity = isBlank(input.recentActivity)
    ? []
    : [{ type: 'note', daysAgo: lastContactDaysAgo, from: clean(input.championName) || clean(input.buyerName) || 'Account team', summary: clean(input.recentActivity) }];

  return {
    id: input.id,
    custom: true,
    name: clean(input.name),
    industry: clean(input.industry) || 'Other',
    segment: input.segment || 'Mid-Market',
    plan: input.plan || 'Business',
    arr: num(input.arr),
    seats: num(input.seats, 1),
    renewalInDays: Math.max(0, daysFromToday(input.renewalDate, today)),
    nps: num(input.nps),
    usage,
    goals: isBlank(input.goal) ? [] : [clean(input.goal)],
    contacts,
    tickets: parseTickets(input.tickets),
    activity,
  };
}
