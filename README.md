# Account Prep Brief

Prep for any account in seconds: a one-page brief for existing customers, and research plus an account plan for greenfield prospects. Built for selling Factory's Droids.

Prepping usually means 20 to 30 minutes of clicking through the CRM, usage dashboards, the support queue, NPS results, old emails, LinkedIn, and news. This app pulls it into one page and tells you what to do next.

**Existing customers**
- **Health score** (0 to 100) with a breakdown of what moved it
- **Risks and opportunities**, each with the evidence and where it came from
- **Talking points and questions to ask**, generated from those findings
- **Stakeholder map**, including champions who have left
- **Agenda email draft** addressed to the right person, ready to copy
- **Add your own accounts** with a short form, then edit them and watch the brief update
- **Paste your own notes** from a call or email, and the brief updates with any new signals

**Greenfield prospects**
- **Fit score and tier** based on engineering team size, trigger events, research signals, and known contacts
- **Live company research**: a Wikipedia summary pulled in when the plan opens, plus one-click links to news, LinkedIn, engineering blogs, job posts, GitHub, and SEC filings
- **Hypotheses for why they might need Droids**, each with the evidence behind it and a confidence level
- **Who to target**: champion, economic buyer, technical evaluator, and security reviewer, with known contacts mapped by title and LinkedIn searches for the gaps
- **Discovery questions, a 14-day outreach sequence, and a first email draft**
- **30/60/90-day account plan** with a pilot success measure

Copy any brief or plan as Markdown, or print it to PDF.

## Run it

**Live site:** https://king-zilo.github.io/account-prep-brief/

The app runs entirely in the browser, so the live site needs nothing installed. It is hosted on GitHub Pages from the `docs/` folder. The Wikipedia lookup needs an internet connection; everything else works offline.

To run it locally instead (Node.js 20 or newer, no dependencies):

```bash
npm start        # http://localhost:3000
npm test         # 24 tests
```

## How it works

| File | Purpose |
| --- | --- |
| `docs/data/accounts.json` | Sample customer accounts (fictional), plus your name and company. Dates are stored as "days ago" so the demo always looks current. |
| `docs/data/product.json` | The Factory playbook: use cases, the pains and value for each, the signals that point to them, buyer personas, and discovery questions. Edit this to tailor plans. |
| `docs/brief.js` | Customer brief logic: health score, risk and opportunity rules, keyword signals, talking points, email draft. |
| `docs/custom-accounts.js` | Turns the New account form into an account: validation, dates, usage trend, and ticket parsing. |
| `docs/prospect.js` | Prospect plan logic: fit score, hypothesis ranking, persona mapping, outreach sequence, email, and 30/60/90-day plan. |
| `docs/research.js` | Wikipedia company lookup, with a name check so unrelated articles are ignored. |
| `docs/app.js`, `docs/index.html`, `docs/styles.css` | The single-page UI (plain HTML, CSS, and JavaScript). |
| `server.js` | Optional local static server for `npm start`. |
| `test/` | Tests for the scoring rules, signals, emails, forms, prospect plans, research lookup, and server. |

**Customer health score:** starts at 85 and each finding adds or subtracts points. For example, a departed champion is -20, an open P1 ticket is -15, and seat utilization above 90% is +5.

**Prospect fit score:** starts at 50. Team size adds -10 to +25, each trigger event adds 8 (up to four), research notes that point to a use case add 4 each (up to two), and a known champion or economic buyer adds 5 each. Tier 1 is 80 and above, Tier 2 is 60 to 79.

The rules are deterministic, so the demo always gives the same result. Connecting a real CRM or an LLM would be a next step (see below).

## Demo script (about 8 minutes)

1. **The problem.** "Before each call I spend about 30 minutes pulling context from five tools. For a new logo, research and planning takes even longer."
2. **At-risk customer: Northwind Logistics.** The champion has left, there is an open P1 ticket, usage is down, and the email mentions "evaluating alternatives." The email draft goes to the economic buyer because the champion is gone.
3. **Add a customer live.** Click **+ New account**, then **Fill with example** (Acme Robotics), then **Generate brief**. It scores 90. Click **Edit account**, check **Champion has left the company**, and save. The score drops to 70 and the email switches to the economic buyer.
4. **Greenfield prospect.** Click **+ New prospect**, then **Fill with example** (Harborline Financial), then **Build research and plan**. It scores 86, Tier 1, with migrations and modernization as the lead hypothesis. The evidence comes from the tech stack and research notes.
5. **Update it live.** Click **Edit prospect**. Add `Priya Raman, VP Engineering` to Known contacts and check **AI initiative announced**. Save. The score rises to 99, secure AI adoption appears as a hypothesis, and the economic buyer gap is filled.
6. **Live research on a real company.** Click **+ New prospect** and type a real company, for example `Capital One`, Financial services, 1,000 or more engineers. The Wikipedia summary loads into Company research, and the research links open news, LinkedIn, and filings for that company.
7. **Take it with you.** Click **Copy email**, **Copy plan**, or **Print / PDF**.
8. **How I built it with Droid.** Walk through the prompts, the fixes made along the way, and the tests.

Accounts and prospects you add are saved in your browser only (local storage). Use **Delete** to remove them after the demo.

## Next steps

- Pull accounts from Salesforce or HubSpot instead of `docs/data/accounts.json`
- Use an LLM to summarize news, earnings calls, and engineering blogs into the research notes
- Send a brief automatically each morning for that day's meetings
