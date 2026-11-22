const SEARCH_URL = 'https://en.wikipedia.org/w/api.php';
const SUMMARY_URL = 'https://en.wikipedia.org/api/rest_v1/page/summary/';
const IGNORED_WORDS = new Set(['inc', 'corp', 'corporation', 'co', 'company', 'llc', 'ltd', 'limited', 'plc', 'group', 'the', 'and', 'holdings']);

const words = (s) => s.toLowerCase().normalize('NFKD').replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter((w) => w && !IGNORED_WORDS.has(w));

// Wikipedia search returns loosely related pages for unknown names, so a result only
// counts when its title contains every meaningful word of the company name.
export function titleMatches(companyName, title) {
  const wanted = words(companyName);
  const have = new Set(words(title));
  return wanted.length > 0 && wanted.every((w) => have.has(w));
}

const extraWords = (companyName, title) => words(title).length - words(companyName).length;

export async function lookupCompany(companyName, fetchImpl = fetch) {
  const params = new URLSearchParams({ action: 'query', list: 'search', srsearch: `${companyName} company`, srlimit: '5', format: 'json', origin: '*' });
  const search = await fetchImpl(`${SEARCH_URL}?${params}`);
  if (!search.ok) throw new Error(`Wikipedia search failed (${search.status})`);
  const results = (await search.json())?.query?.search || [];
  const match = results
    .filter((r) => titleMatches(companyName, r.title))
    .sort((a, b) => extraWords(companyName, a.title) - extraWords(companyName, b.title))[0];
  if (!match) return null;

  const summary = await fetchImpl(SUMMARY_URL + encodeURIComponent(match.title.replaceAll(' ', '_')));
  if (!summary.ok) throw new Error(`Wikipedia summary failed (${summary.status})`);
  const data = await summary.json();
  if (data.type !== 'standard') return null;
  return {
    title: data.title,
    description: data.description || '',
    extract: data.extract || '',
    url: data.content_urls?.desktop?.page || `https://en.wikipedia.org/wiki/${encodeURIComponent(match.title)}`,
  };
}
