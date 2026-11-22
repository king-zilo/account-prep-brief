export const TRIGGERS = [
  { id: 'leader', label: 'New engineering leader', hook: 'Congratulations on the recent engineering leadership changes at {company}. New leaders often take a fresh look at how the team ships.' },
  { id: 'funding', label: 'Recent funding round', hook: 'Congratulations on the recent funding at {company}. That usually comes with pressure to ship the roadmap faster.' },
  { id: 'hiring', label: 'Hiring many engineers', hook: 'I noticed {company} is hiring a lot of engineers right now.' },
  { id: 'migration', label: 'Cloud or legacy migration', hook: 'It looks like {company} has a modernization effort underway.' },
  { id: 'ai', label: 'AI initiative announced', hook: 'I saw that {company} is investing in AI across the business.' },
  { id: 'security', label: 'Security or compliance push', hook: 'I know security and compliance are a big focus at {company} right now.' },
  { id: 'mna', label: 'Merger or acquisition', hook: 'With the recent acquisition news at {company}, I imagine there is a lot of code to bring together.' },
  { id: 'costcut', label: 'Cost cutting or layoffs', hook: 'Many engineering teams, likely including {company}, are being asked to deliver more with the same headcount.' },
];

export const INDUSTRIES = [
  { id: 'software', label: 'Software and internet' },
  { id: 'finance', label: 'Financial services', regulated: true },
  { id: 'healthcare', label: 'Healthcare and life sciences', regulated: true },
  { id: 'public', label: 'Public sector', regulated: true },
  { id: 'retail', label: 'Retail and e-commerce' },
  { id: 'manufacturing', label: 'Manufacturing and industrial' },
  { id: 'other', label: 'Other' },
];

export const ENG_SIZES = [
  { id: 'xs', label: 'Under 50 engineers', phrase: 'fewer than 50 engineers', fit: -10 },
  { id: 's', label: '50 to 199 engineers', phrase: '50 to 200 engineers', fit: 5 },
  { id: 'm', label: '200 to 999 engineers', phrase: 'a few hundred engineers', fit: 15 },
  { id: 'l', label: '1,000 or more engineers', phrase: 'more than 1,000 engineers', fit: 25 },
];

const BASE_FIT = 50;
const TRIGGER_FIT = 8;
const MAX_TRIGGERS_SCORED = 4;

const clean = (value) => String(value ?? '').trim();
const firstName = (name) => clean(name).split(/\s+/)[0];
const lowerFirst = (s) => s.charAt(0).toLowerCase() + s.slice(1);
const byId = (list, id) => list.find((item) => item.id === id);

export function normalizeDomain(website) {
  return clean(website).replace(/^https?:\/\//i, '').replace(/^www\./i, '').replace(/\/.*$/, '').toLowerCase();
}

export function exampleProspect() {
  return {
    name: 'Harborline Financial',
    website: 'harborline.example',
    industry: 'finance',
    engSize: 'm',
    triggers: ['migration'],
    stack: 'Large Java monolith running on-prem, moving to AWS. GitHub Enterprise.',
    contacts: 'Marcus Hill, Director of Platform Engineering',
    notes: 'Engineering blog describes a multi-year effort to break up the legacy monolith. Job posts mention a growing code review backlog.',
  };
}

export function validateProspect(input) {
  const errors = {};
  if (!clean(input.name)) errors.name = 'Enter a company name.';
  if (!byId(INDUSTRIES, input.industry)) errors.industry = 'Choose an industry.';
  if (!byId(ENG_SIZES, input.engSize)) errors.engSize = 'Choose the engineering team size.';
  if (clean(input.website) && !/^[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$/i.test(normalizeDomain(input.website))) {
    errors.website = 'Enter a website like example.com.';
  }
  return errors;
}

export function parseContacts(text = '') {
  return String(text)
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [name, ...rest] = line.split(',');
      return { name: name.trim(), title: rest.join(',').trim() };
    });
}

function sentenceWith(text, keyword) {
  const sentences = text.split(/(?<=[.!?])\s+|\n+/).map((s) => s.trim()).filter(Boolean);
  return sentences.find((s) => s.toLowerCase().includes(keyword)) || text.trim();
}

function rankHypotheses(input, product, industry, size) {
  const sources = [
    { label: 'Your notes', text: clean(input.notes) },
    { label: 'Tech stack', text: clean(input.stack) },
  ].filter((s) => s.text);
  const triggers = input.triggers || [];

  const ranked = product.useCases.map((useCase) => {
    const evidence = [];
    let strength = 0;
    for (const id of triggers) {
      if (useCase.triggers.includes(id)) {
        evidence.push(`Trigger: ${byId(TRIGGERS, id).label}`);
        strength += 2;
      }
    }
    if (useCase.industries.includes(industry.id)) {
      evidence.push(`Industry: ${industry.label}`);
      strength += 1;
    }
    for (const source of sources) {
      const lower = source.text.toLowerCase();
      const keyword = useCase.signals.find((k) => lower.includes(k));
      if (keyword) {
        evidence.push(`${source.label}: "${sentenceWith(source.text, keyword)}"`);
        strength += 2;
      }
    }
    if (useCase.id === 'velocity' && (size.id === 'm' || size.id === 'l')) {
      evidence.push(`Team size: ${size.label}`);
      strength += 1;
    }
    return { ...useCase, evidence, strength, confidence: strength >= 4 ? 'Strong' : strength >= 2 ? 'Moderate' : 'Early' };
  });

  const relevant = ranked.filter((h) => h.strength > 0).sort((a, b) => b.strength - a.strength);
  if (relevant.length) return relevant.slice(0, 3);
  const fallback = ranked.find((h) => h.id === 'velocity');
  return [{ ...fallback, evidence: ['Starting point for any engineering team. Add triggers or notes to sharpen this.'], confidence: 'Early' }];
}

function mapPersonas(input, product, regulated) {
  const contacts = parseContacts(input.contacts);
  const personas = product.personas.map((p) => ({ ...p, pattern: new RegExp(p.match, 'i'), contacts: [] }));
  const unmatched = [];
  for (const contact of contacts) {
    const persona = personas.find((p) => p.pattern.test(contact.title));
    if (persona) persona.contacts.push(contact);
    else unmatched.push(contact);
  }
  const company = clean(input.name);
  // Display order follows a typical deal: champion first, security last unless the industry is regulated.
  const order = regulated
    ? ['Champion', 'Economic buyer', 'Security reviewer', 'Technical evaluator']
    : ['Champion', 'Economic buyer', 'Technical evaluator', 'Security reviewer'];
  return {
    personas: order
      .map((role) => personas.find((p) => p.role === role))
      .filter(Boolean)
      .map(({ pattern, match, ...p }) => ({
        ...p,
        priority: p.role === 'Security reviewer' && regulated ? 'Bring in early: regulated industry' : '',
        searchUrl: `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(`${company} ${p.search}`)}`,
      })),
    unmatched,
  };
}

export function researchLinks(input) {
  const name = clean(input.name);
  const q = (s) => encodeURIComponent(s);
  const domain = normalizeDomain(input.website);
  const links = [
    { label: 'Recent news', url: `https://news.google.com/search?q=${q(`"${name}"`)}`, why: 'Look for funding, leadership changes, and AI announcements.' },
    { label: 'Engineering leaders on LinkedIn', url: `https://www.linkedin.com/search/results/people/?keywords=${q(`${name} engineering`)}`, why: 'Fill in the buying committee.' },
    { label: 'Engineering blog', url: `https://www.google.com/search?q=${q(`"${name}" engineering blog`)}`, why: 'Find migrations, stack details, and pain points.' },
    { label: 'Open engineering roles', url: `https://www.google.com/search?q=${q(`"${name}" software engineer jobs`)}`, why: 'Hiring volume and the tools they mention.' },
    { label: 'GitHub', url: `https://github.com/search?q=${q(name)}&type=users`, why: 'Public repositories and languages.' },
    { label: 'SEC filings', url: `https://www.sec.gov/cgi-bin/browse-edgar?company=${q(name)}&type=10-K&action=getcompany`, why: 'For public companies: strategy and risk factors.' },
  ];
  if (domain) links.unshift({ label: 'Company website', url: `https://${domain}`, why: 'Products, customers, and positioning.' });
  return links;
}

function scoreFit(input, size, hypotheses, personas) {
  const drivers = [{ label: `Engineering team: ${size.label}`, impact: size.fit }];
  const triggers = (input.triggers || []).slice(0, MAX_TRIGGERS_SCORED);
  for (const id of triggers) drivers.push({ label: `Trigger: ${byId(TRIGGERS, id).label}`, impact: TRIGGER_FIT });
  const fromNotes = hypotheses.filter((h) => h.evidence.some((e) => e.startsWith('Your notes') || e.startsWith('Tech stack'))).slice(0, 2);
  for (const h of fromNotes) drivers.push({ label: `Research points to ${lowerFirst(h.name)}`, impact: 4 });
  const keyRoles = personas.filter((p) => (p.role === 'Champion' || p.role === 'Economic buyer') && p.contacts.length);
  if (keyRoles.length) drivers.push({ label: `Known ${keyRoles.map((p) => p.role.toLowerCase()).join(' and ')}`, impact: 5 * keyRoles.length });
  const score = Math.min(100, Math.max(0, BASE_FIT + drivers.reduce((sum, d) => sum + d.impact, 0)));
  const tier = score >= 80 ? { tier: 'Tier 1', label: 'Prioritize now', level: 'good' } : score >= 60 ? { tier: 'Tier 2', label: 'Targeted outreach', level: 'warn' } : { tier: 'Tier 3', label: 'Monitor and nurture', level: '' };
  return { score, ...tier, drivers: drivers.sort((a, b) => b.impact - a.impact) };
}

function contactOrRole(persona) {
  const c = persona?.contacts[0];
  return c ? `${c.name}${c.title ? ` (${c.title})` : ''}` : `a ${persona.role.toLowerCase()} (${persona.titles})`;
}

function buildSequence(company, hypotheses, personas, regulated) {
  const role = (r) => personas.find((p) => p.role === r);
  const [top, second] = hypotheses;
  const steps = [
    { day: 1, channel: 'Email', target: contactOrRole(role('Champion')), action: `Send the first email below, leading with ${lowerFirst(top.name)}.` },
    { day: 2, channel: 'LinkedIn', target: contactOrRole(role('Economic buyer')), action: `Connect with a short note about how teams like ${company}'s approach ${lowerFirst(top.name)}.` },
    { day: 4, channel: 'Email', target: contactOrRole(role('Technical evaluator')), action: `Share a short, practical example of Droids handling ${lowerFirst(top.name)} work.` },
    { day: 7, channel: 'Call', target: contactOrRole(role('Champion')), action: `Call and ask: "${top.question}"` },
    { day: 10, channel: 'Email', target: contactOrRole(role('Economic buyer')), action: `Frame the business case around ${lowerFirst((second || top).name)}. ${(second || top).value}` },
  ];
  if (regulated) {
    steps.push({ day: 12, channel: 'Email', target: contactOrRole(role('Security reviewer')), action: 'Offer a security overview before anyone asks for it.' });
  }
  steps.push({ day: 14, channel: 'Email', target: contactOrRole(role('Champion')), action: `Send a short closing note: ask whether ${lowerFirst(top.name)} is a priority this quarter, and offer to reconnect later if not.` });
  return steps;
}

function buildEmail(input, hypotheses, personas, size, owner, product) {
  const company = clean(input.name);
  const champion = personas.find((p) => p.role === 'Champion')?.contacts[0];
  const top = hypotheses[0];
  const selected = (input.triggers || []).map((id) => byId(TRIGGERS, id)).filter(Boolean);
  const trigger = selected.find((t) => top.triggers?.includes(t.id)) || selected[0];
  const hook = trigger ? trigger.hook.replaceAll('{company}', company) : `I've been researching ${company} and how your engineering team works.`;
  return {
    to: champion ? `${champion.name}${champion.title ? ` (${champion.title})` : ''}` : 'Champion (find one using the research links)',
    subject: `${top.name} at ${company}`,
    body: `Hi ${champion ? firstName(champion.name) : '[first name]'},

${hook}

For engineering teams with ${size.phrase}, a common challenge is that ${lowerFirst(top.pain)} ${top.value}

Would you be open to a 20-minute call to see whether this fits what ${company} is working on?

Best,
${owner.name}
${owner.title}, ${product.company}`,
  };
}

function buildPlan(hypotheses, personas, regulated) {
  const top = hypotheses[0];
  const gaps = personas.filter((p) => !p.contacts.length).map((p) => p.role.toLowerCase());
  const champion = personas.find((p) => p.role === 'Champion');
  const buyer = personas.find((p) => p.role === 'Economic buyer');
  return [
    {
      phase: 'Days 1 to 30',
      title: 'Research and first meeting',
      tasks: [
        'Use the research links to confirm or rule out each hypothesis.',
        gaps.length ? `Find names for the ${gaps.join(', ')}.` : 'Confirm each contact still holds their role.',
        'Run the outreach sequence.',
        `Book a discovery call with ${contactOrRole(champion)}.`,
      ],
    },
    {
      phase: 'Days 31 to 60',
      title: 'Discovery and pilot scope',
      tasks: [
        `Validate "${top.name}" using the discovery questions.`,
        `Agree on a pilot focused on ${lowerFirst(top.name)}. Success measure: ${lowerFirst(top.metric)}.`,
        regulated ? 'Start the security review now. Regulated industries take longer to approve.' : 'Share security and deployment documentation with the technical evaluator.',
        `Meet ${contactOrRole(buyer)} to confirm priorities and budget timing.`,
      ],
    },
    {
      phase: 'Days 61 to 90',
      title: 'Pilot and business case',
      tasks: [
        'Run the pilot on a real repository with the technical evaluator.',
        'Review pilot results against the success measure with the champion.',
        'Build the business case and proposal with the economic buyer.',
        'Agree on a decision date and the steps to get there.',
      ],
    },
  ];
}

function toMarkdown(p) {
  const list = (items, fmt) => (items.length ? items.map(fmt).join('\n') : '- None');
  return `# Account research and plan: ${p.prospect.name}
_Generated ${p.generatedOn}_

**Fit:** ${p.fit.score}/100 (${p.fit.tier}, ${p.fit.label})
**Industry:** ${p.prospect.industryLabel} | **Engineering team:** ${p.prospect.engSizeLabel}${p.prospect.domain ? ` | **Website:** ${p.prospect.domain}` : ''}

## Why they might need ${p.product.product}
${list(p.hypotheses, (h) => `- **${h.name}** (${h.confidence}): ${h.value}\n${h.evidence.map((e) => `  - ${e}`).join('\n')}`)}

## Who to target
${list(p.personas, (r) => `- **${r.role}** (${r.titles}): ${r.contacts.length ? r.contacts.map((c) => `${c.name}${c.title ? `, ${c.title}` : ''}`).join('; ') : 'Not found yet'}`)}

## Discovery questions
${list(p.questions, (q) => `- ${q}`)}

## Outreach sequence
${list(p.sequence, (s) => `- Day ${s.day}, ${s.channel}, ${s.target}: ${s.action}`)}

## First email
**To:** ${p.email.to}
**Subject:** ${p.email.subject}

${p.email.body}

## 30/60/90-day plan
${p.plan.map((ph) => `### ${ph.phase}: ${ph.title}\n${ph.tasks.map((t) => `- ${t}`).join('\n')}`).join('\n\n')}

## Research links
${list(p.researchLinks, (l) => `- [${l.label}](${l.url}): ${l.why}`)}
`;
}

export function generatePlan(input, product, { owner = { name: 'Your name', title: 'Account Executive' }, today = new Date() } = {}) {
  const industry = byId(INDUSTRIES, input.industry) || byId(INDUSTRIES, 'other');
  const size = byId(ENG_SIZES, input.engSize) || ENG_SIZES[1];
  const regulated = Boolean(industry.regulated);
  const company = clean(input.name);
  const hypotheses = rankHypotheses(input, product, industry, size);
  const { personas, unmatched } = mapPersonas(input, product, regulated);

  const questions = [...new Set([
    ...hypotheses.map((h) => h.question),
    ...(regulated && !hypotheses.some((h) => h.id === 'governance') ? [product.useCases.find((u) => u.id === 'governance').question] : []),
    ...product.discoveryQuestions,
  ])];

  const plan = {
    generatedOn: today.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
    product: { company: product.company, product: product.product },
    prospect: {
      id: input.id,
      name: company,
      domain: normalizeDomain(input.website),
      industryLabel: industry.label,
      engSizeLabel: size.label,
      regulated,
      triggers: (input.triggers || []).map((id) => byId(TRIGGERS, id)?.label).filter(Boolean),
    },
    fit: scoreFit(input, size, hypotheses, personas),
    hypotheses,
    personas,
    otherContacts: unmatched,
    questions,
    sequence: buildSequence(company, hypotheses, personas, regulated),
    email: buildEmail(input, hypotheses, personas, size, owner, product),
    plan: buildPlan(hypotheses, personas, regulated),
    researchLinks: researchLinks(input),
  };
  plan.markdown = toMarkdown(plan);
  return plan;
}
