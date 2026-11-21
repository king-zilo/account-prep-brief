# Account Prep Brief

A one-page brief for any account, ready in seconds before a customer call.

Prepping for a call usually means 20 to 30 minutes of clicking through the CRM, usage dashboards, the support queue, NPS results, and old emails. This app pulls all of that into one page and tells you what to do with it:

- **Health score** (0 to 100) with a breakdown of what moved it
- **Risks and opportunities**, each with the evidence and where it came from
- **Talking points and questions to ask**, generated from those findings
- **Stakeholder map**, including champions who have left
- **Agenda email draft** addressed to the right person, ready to copy
- **Paste your own notes** from a call or email, and the brief updates with any new signals
- Copy the brief as Markdown, or print it to PDF

## Run it

**Live site:** https://king-zilo.github.io/account-prep-brief/

The app runs entirely in the browser, so the live site needs nothing installed. It is hosted on GitHub Pages from the `docs/` folder.

To run it locally instead (Node.js 20 or newer, no dependencies):

```bash
npm start        # http://localhost:3000
npm test         # 8 tests
```

## How it works

| File | Purpose |
| --- | --- |
| `docs/data/accounts.json` | Sample accounts (fictional). Dates are stored as "days ago" so the demo always looks current. |
| `docs/brief.js` | All the logic: health score, risk and opportunity rules, keyword signals, talking points, email draft. |
| `docs/app.js`, `docs/index.html`, `docs/styles.css` | The single-page UI (plain HTML, CSS, and JavaScript). |
| `server.js` | Optional local static server for `npm start`. |
| `test/brief.test.js` | Tests for the scoring rules, signals, email, and server. |

The health score starts at 85 and each finding adds or subtracts points. For example, a departed champion is -20, an open P1 ticket is -15, and seat utilization above 90% is +5. Keyword signals such as "evaluating alternatives" or "more seats" are detected in recent activity and in any notes you paste. The result is clamped to 0 to 100.

The rules are deterministic, so the demo works offline and always gives the same result. Connecting a real CRM or an LLM would be a next step (see below).

## Demo script (about 5 minutes)

1. **The problem.** "Before each call I spend about 30 minutes pulling context from five tools."
2. **Healthy account: Brightpath Health.** The score is 100. Point out the expansion and reference opportunities, which the app found in a call note and an email.
3. **At-risk account: Northwind Logistics.** The champion has left, there is an open P1 ticket, usage is down, and the email mentions "evaluating alternatives." The email draft goes to the economic buyer because the champion is gone.
4. **Live update: Summit Retail Group.** Open "Add notes" and paste:
   `Laura mentioned a spend freeze and they are evaluating alternatives.`
   Click **Update brief**. The score drops, and two new risks appear, labeled "from your notes."
5. **Take it with you.** Click **Copy email** or **Print / PDF**.
6. **How I built it with Droid.** Walk through the prompts, the fixes made along the way, and the tests.

## Next steps

- Pull accounts from Salesforce or HubSpot instead of `docs/data/accounts.json`
- Use an LLM to summarize long email threads and personalize the email draft
- Send a brief automatically each morning for that day's meetings
