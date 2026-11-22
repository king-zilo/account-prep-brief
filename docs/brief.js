const DAY_MS = 24 * 60 * 60 * 1000;

const SIGNALS = [
  {
    key: 'churn', type: 'risk', label: 'Churn language', impact: -20,
    pattern: /\b(cancel\w*|churn\w*|not renew\w*|won't renew|terminate\w*)\b/i,
    talkingPoint: 'Address cancellation language directly and ask what would need to change to earn the renewal.',
    question: 'What would need to be true for you to renew with confidence?',
  },
  {
    key: 'competitor', type: 'risk', label: 'Competitive threat', impact: -10,
    pattern: /\b(competitors?|alternatives?|evaluating|rfp|switch(ing)? to)\b/i,
    talkingPoint: 'Find out what is driving the evaluation and re-anchor on the outcomes they have already achieved.',
    question: 'What is prompting the look at other options, and what would a great outcome look like?',
  },
  {
    key: 'budget', type: 'risk', label: 'Budget pressure', impact: -10,
    pattern: /\b(budget|cost[- ]cutting|too expensive|discount|spend freeze|roi)\b/i,
    talkingPoint: 'Bring an ROI summary tied to their goals before pricing comes up.',
    question: 'How is next year\'s budget being decided, and who signs off?',
  },
  {
    key: 'frustration', type: 'risk', label: 'Product frustration', impact: -5,
    pattern: /\b(frustrat\w*|outage|downtime|blocking|unhappy|disappointed|slower than expected)\b/i,
    talkingPoint: 'Acknowledge the frustration first and share a concrete fix or workaround.',
    question: 'Which issue is costing your team the most time right now?',
  },
  {
    key: 'stakeholder', type: 'risk', label: 'Stakeholder change', impact: -10,
    pattern: /\b(reorg\w*|leaving|left the company|new (vp|cio|cto|cfo|director|head))\b/i,
    talkingPoint: 'Map the new org and secure an introduction to whoever now owns the initiative.',
    question: 'Who is now responsible for this initiative day to day?',
  },
  {
    key: 'expansion', type: 'opportunity', label: 'Expansion interest', impact: 5,
    pattern: /\b(more seats|additional (teams?|seats|licenses)|expan\w*|roll(ing)? out to|rolling out|another (team|department|region))\b/i,
    talkingPoint: 'Scope the expansion: which teams, how many seats, and what timeline.',
    question: 'Which teams would benefit next, and when would they want to start?',
    emailLine: 'Options for bringing additional teams onto the platform',
  },
  {
    key: 'advocacy', type: 'opportunity', label: 'Advocacy potential', impact: 5,
    pattern: /\b(love\w*|thrilled|great results|case study|reference)\b/i,
    talkingPoint: 'Ask for a reference call or case study while sentiment is high.',
    question: 'Would you be open to sharing your results with a peer in your industry?',
  },
];

const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));

function formatDate(date) {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
}

function formatMoney(n) {
  return '$' + n.toLocaleString('en-US');
}

function firstName(fullName) {
  return fullName.split(' ')[0];
}

function sentenceContaining(text, pattern) {
  const sentences = text.split(/(?<=[.!?])\s+|\n+/).map((s) => s.trim()).filter(Boolean);
  return sentences.find((s) => pattern.test(s)) || text.trim();
}

function detectSignals(sources) {
  const found = new Map();
  for (const source of sources) {
    for (const signal of SIGNALS) {
      if (found.has(signal.key) || !signal.pattern.test(source.text)) continue;
      found.set(signal.key, {
        type: signal.type,
        title: signal.label,
        detail: `"${sentenceContaining(source.text, signal.pattern)}"`,
        source: source.label,
        impact: signal.impact,
        talkingPoint: signal.talkingPoint,
        question: signal.question,
        emailLine: signal.emailLine,
      });
    }
  }
  return [...found.values()];
}

function dataFindings(account) {
  const findings = [];
  const usage = account.usage;
  const latest = usage[usage.length - 1];
  const threeMonthsAgo = usage[Math.max(0, usage.length - 4)];
  const change = threeMonthsAgo ? Math.round(((latest - threeMonthsAgo) / threeMonthsAgo) * 100) : 0;

  if (change <= -10) {
    findings.push({
      type: 'risk',
      title: `Usage down ${Math.abs(change)}% over 3 months`,
      detail: `Monthly active users fell from ${threeMonthsAgo} to ${latest}.`,
      source: 'Product usage',
      impact: change <= -15 ? -20 : -10,
      talkingPoint: 'Walk through the usage trend and identify which teams have stopped logging in.',
      question: 'Which teams have changed how they work with the product this quarter?',
      emailLine: 'A look at how your teams are using the platform and where we can help re-engage them',
    });
  } else if (change >= 10) {
    findings.push({
      type: 'opportunity',
      title: `Usage up ${change}% over 3 months`,
      detail: `Monthly active users grew from ${threeMonthsAgo} to ${latest}.`,
      source: 'Product usage',
      impact: 5,
      talkingPoint: 'Celebrate the adoption growth and connect it to their stated goals.',
      question: 'What has driven the growth, and where else could that work?',
    });
  }

  const utilization = Math.round((latest / account.seats) * 100);
  if (utilization < 60) {
    findings.push({
      type: 'risk',
      title: `Only ${utilization}% of seats active`,
      detail: `${latest} of ${account.seats} licensed seats used last month.`,
      source: 'Product usage',
      impact: -15,
      talkingPoint: 'Offer an enablement session for teams that have not started yet.',
      question: 'What is holding the remaining users back from getting started?',
      emailLine: 'A training plan for the teams that have not started yet',
    });
  } else if (utilization >= 90) {
    findings.push({
      type: 'opportunity',
      title: `Seat utilization at ${utilization}%`,
      detail: `${latest} of ${account.seats} licensed seats used last month.`,
      source: 'Product usage',
      impact: 5,
      talkingPoint: 'Raise a seat expansion before they hit the limit.',
      question: 'Are there people waiting for access today?',
      emailLine: 'Making sure you have enough seats for everyone who needs access',
    });
  }

  for (const contact of account.contacts.filter((c) => c.status === 'left' && c.role === 'Champion')) {
    findings.push({
      type: 'risk',
      title: `Champion ${contact.name} has left`,
      detail: `${contact.title} was the main internal advocate.`,
      source: 'Contacts',
      impact: -20,
      talkingPoint: 'Identify and start building a new champion.',
      question: `Who has picked up ${firstName(contact.name)}'s responsibilities for this rollout?`,
    });
  }

  const openTickets = account.tickets.filter((t) => t.status === 'open');
  for (const ticket of openTickets.filter((t) => t.priority === 'P1')) {
    findings.push({
      type: 'risk',
      title: `Open P1: ${ticket.title}`,
      detail: ticket.openedDaysAgo == null ? `${ticket.id}.` : `${ticket.id}, open for ${ticket.openedDaysAgo} days.`,
      source: 'Support',
      impact: -15,
      talkingPoint: `Get a status update on ${ticket.id} from support before the call and lead with it.`,
      emailLine: `An update on ${ticket.title.toLowerCase()} (${ticket.id}) and our plan to resolve it`,
    });
  }
  const p2 = openTickets.filter((t) => t.priority === 'P2');
  if (p2.length) {
    findings.push({
      type: 'risk',
      title: `${p2.length} open P2 ticket${p2.length > 1 ? 's' : ''}`,
      detail: p2.map((t) => `${t.id}: ${t.title}`).join('; '),
      source: 'Support',
      impact: -5 * Math.min(p2.length, 2),
      talkingPoint: 'Review open tickets and confirm owners and dates for each fix.',
      emailLine: 'Status of your open support tickets',
    });
  }

  if (account.nps <= 6) {
    findings.push({
      type: 'risk', title: `Detractor NPS (${account.nps})`, detail: 'Latest survey score from the account.',
      source: 'NPS survey', impact: -15,
      talkingPoint: 'Ask what drove the low score and what one change would improve it.',
      question: 'If you could change one thing about working with us, what would it be?',
    });
  } else if (account.nps <= 8) {
    findings.push({
      type: 'risk', title: `Passive NPS (${account.nps})`, detail: 'Satisfied but not enthusiastic.',
      source: 'NPS survey', impact: -5,
      talkingPoint: 'Find the gap between "fine" and "great" for them.',
    });
  } else {
    findings.push({
      type: 'opportunity', title: `Promoter NPS (${account.nps})`, detail: 'Latest survey score from the account.',
      source: 'NPS survey', impact: 5,
      talkingPoint: 'Thank them for the score and explore a reference or case study.',
    });
  }

  const active = account.contacts.filter((c) => c.status !== 'left');
  const lastTouch = Math.min(...active.map((c) => c.lastContactDaysAgo));
  if (active.length && lastTouch > 30) {
    findings.push({
      type: 'risk', title: `No contact in ${lastTouch} days`, detail: 'No recent touchpoint with any active contact.',
      source: 'Contacts', impact: -10,
      talkingPoint: 'Re-establish a regular cadence, such as a monthly check-in.',
    });
  }

  return findings;
}

function healthLevel(score) {
  if (score >= 75) return { label: 'Healthy', level: 'good' };
  if (score >= 50) return { label: 'Needs attention', level: 'warn' };
  return { label: 'At risk', level: 'bad' };
}

function pickRecipient(contacts) {
  const active = contacts.filter((c) => c.status !== 'left');
  return (
    active.find((c) => c.role === 'Champion') ||
    active.find((c) => c.role === 'Economic buyer') ||
    active.find((c) => c.role === 'Executive sponsor') ||
    active[0] ||
    null
  );
}

function buildEmail(account, findings, renewalDate, owner, vendor) {
  const to = pickRecipient(account.contacts);
  const lines = findings.filter((f) => f.emailLine).map((f) => f.emailLine);
  if (account.renewalInDays <= 120) lines.push(`Planning ahead for your renewal on ${formatDate(renewalDate)}`);
  if (account.goals[0]) lines.unshift(`Progress on your goal to ${account.goals[0].charAt(0).toLowerCase()}${account.goals[0].slice(1)}`);
  const agenda = lines.slice(0, 4).map((l) => `- ${l}`).join('\n');
  const greeting = to ? `Hi ${firstName(to.name)},` : 'Hi there,';
  const body = `${greeting}

Thanks for making time to connect. To make the most of our conversation, here is what I would like to cover:

${agenda}

If there is anything else on your mind, reply here and I will add it to the list.

Best,
${owner.name}
${owner.title}, ${vendor}`;
  return {
    to: to ? `${to.name} (${to.title})` : '',
    subject: `${account.name} + ${vendor}: agenda for our upcoming check-in`,
    body,
  };
}

function toMarkdown(brief) {
  const a = brief.account;
  const list = (items, fmt) => (items.length ? items.map(fmt).join('\n') : '- None');
  return `# Account prep brief: ${a.name}
_Generated ${brief.generatedOn}_

**Health:** ${brief.health.score}/100 (${brief.health.label})
**ARR:** ${a.arrFormatted} | **Plan:** ${a.plan} | **Seats:** ${a.seats} | **Renewal:** ${a.renewalDate} (${a.renewalInDays} days)

## Risks
${list(brief.risks, (f) => `- **${f.title}** (${f.source}): ${f.detail}`)}

## Opportunities
${list(brief.opportunities, (f) => `- **${f.title}** (${f.source}): ${f.detail}`)}

## Talking points
${list(brief.talkingPoints, (t, i) => `${i + 1}. ${t}`)}

## Questions to ask
${list(brief.questions, (q) => `- ${q}`)}

## Stakeholders
${list(brief.stakeholders, (s) => `- ${s.name}, ${s.title} (${s.role}): ${s.status === 'left' ? 'LEFT COMPANY' : `${s.sentiment}, last contact ${s.lastContactDaysAgo} days ago`}`)}

## Follow-up email
**To:** ${brief.email.to}
**Subject:** ${brief.email.subject}

${brief.email.body}
`;
}

export function generateBrief(account, { notes = '', today = new Date(), owner, vendor = 'Factory' } = {}) {
  const at = (daysAgo) => new Date(today.getTime() - daysAgo * DAY_MS);
  const renewalDate = new Date(today.getTime() + account.renewalInDays * DAY_MS);

  const sources = [];
  if (notes.trim()) sources.push({ label: 'Your notes', text: notes });
  for (const item of account.activity) {
    sources.push({ label: `${item.type[0].toUpperCase()}${item.type.slice(1)} from ${item.from}, ${formatDate(at(item.daysAgo))}`, text: item.summary });
  }

  const championLeft = account.contacts.some((c) => c.status === 'left' && c.role === 'Champion');
  const signals = detectSignals(sources).filter((s) => !(championLeft && s.title === 'Stakeholder change'));
  const findings = [...dataFindings(account), ...signals];
  const score = clamp(85 + findings.reduce((sum, f) => sum + f.impact, 0), 0, 100);
  const risks = findings.filter((f) => f.type === 'risk').sort((x, y) => x.impact - y.impact);
  const opportunities = findings.filter((f) => f.type === 'opportunity').sort((x, y) => y.impact - x.impact);

  const talkingPoints = [];
  if (account.goals[0]) talkingPoints.push(`Open with progress on their top goal: "${account.goals[0]}".`);
  for (const f of [...risks, ...opportunities]) {
    if (f.talkingPoint && !talkingPoints.includes(f.talkingPoint)) talkingPoints.push(f.talkingPoint);
  }
  if (account.renewalInDays <= 90) talkingPoints.push(`Confirm the renewal timeline and decision process (renews in ${account.renewalInDays} days).`);
  talkingPoints.push('Agree on clear next steps with owners and dates before ending the call.');

  const questions = [...new Set(findings.map((f) => f.question).filter(Boolean))];

  const brief = {
    generatedOn: formatDate(today),
    account: {
      id: account.id,
      name: account.name,
      industry: account.industry,
      segment: account.segment,
      plan: account.plan,
      seats: account.seats,
      arr: account.arr,
      arrFormatted: formatMoney(account.arr),
      renewalInDays: account.renewalInDays,
      renewalDate: formatDate(renewalDate),
      usage: account.usage,
      goals: account.goals,
    },
    health: { score, ...healthLevel(score), drivers: findings.map((f) => ({ label: f.title, impact: f.impact })).sort((x, y) => x.impact - y.impact) },
    risks,
    opportunities,
    talkingPoints,
    questions,
    stakeholders: account.contacts,
    openTickets: account.tickets.filter((t) => t.status === 'open'),
    recentActivity: [...account.activity]
      .sort((x, y) => x.daysAgo - y.daysAgo)
      .map((item) => ({ ...item, date: formatDate(at(item.daysAgo)) })),
    email: buildEmail(account, findings, renewalDate, owner || { name: 'Your name', title: 'Account Manager' }, vendor),
  };
  brief.markdown = toMarkdown(brief);
  return brief;
}
