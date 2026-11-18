import { questions, type Candidate, type Verdict } from './game';

const WIKI = { 'User-Agent': 'ipl-climb/0.1 (https://github.com/ajeebtech/krillionjev)' };
const MODEL = 'anthropic/claude-haiku-4.5';

async function wikipedia(params: Record<string, string>) {
  const response = await fetch('https://en.wikipedia.org/w/api.php?' + new URLSearchParams({ action: 'query', format: 'json', redirects: '1', ...params }), { headers: WIKI, cache: 'no-store' });
  if (!response.ok) throw new Error('Wikipedia failed: ' + response.status);
  return (await response.json()).query ?? {};
}

async function ask(request: Request, system: string, user: string) {
  const key = process.env.AI_GATEWAY_API_KEY ?? request.headers.get('x-vercel-oidc-token') ?? process.env.VERCEL_OIDC_TOKEN;
  const response = await fetch((process.env.AI_GATEWAY_URL ?? 'https://ai-gateway.vercel.sh/v1') + '/chat/completions', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: MODEL, temperature: 0, max_tokens: 10, messages: [{ role: 'system', content: system }, { role: 'user', content: user }] }),
  });
  if (!response.ok) throw new Error('Jev failed: ' + response.status + ' ' + (await response.text()).slice(0, 200));
  return String((await response.json()).choices[0].message.content).trim();
}

type Page = { index: number; title: string; description?: string; pageprops?: { disambiguation?: string } };

async function search(text: string) {
  const query = await wikipedia({ generator: 'search', gsrsearch: text, gsrlimit: '5', gsrinfo: 'suggestion', prop: 'pageprops|description', ppprop: 'disambiguation' });
  const pages = (Object.values(query.pages ?? {}) as Page[]).filter(p => !p.pageprops || !('disambiguation' in p.pageprops)).sort((a, b) => a.index - b.index);
  return { pages, suggestion: query.searchinfo?.suggestion as string | undefined };
}

export async function match(request: Request, promptId: string, text: string): Promise<Candidate | null> {
  const question = questions.find(q => q.id === promptId);
  if (!question) return null;
  let { pages, suggestion } = await search(text);
  if (!pages.length && suggestion) ({ pages } = await search(suggestion));
  if (!pages.length) return null;
  let choice = 0;
  if (pages.length > 1) {
    try {
      const reply = await ask(request,
        'A player of a cricket trivia game typed a free-text answer. From the numbered Wikipedia articles, pick the one they most plausibly meant. When several match what they typed, prefer the one that could answer the prompt. Never pick an article they clearly did not type. Reply with the number only.',
        'Prompt: ' + question.prompt + ' (' + question.hint + ')\nPlayer typed: ' + JSON.stringify(text) + '\n' + pages.map((p, i) => (i + 1) + '. ' + p.title + (p.description ? ' — ' + p.description : '')).join('\n'));
      const number = parseInt(reply, 10);
      if (number >= 1 && number <= pages.length) choice = number - 1;
    } catch (error) {
      console.error(error);
    }
  }
  return { title: pages[choice].title, description: pages[choice].description ?? '' };
}

function lastMonth() {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0));
  const stamp = (d: Date) => d.toISOString().slice(0, 10).replace(/-/g, '');
  return { month: start.toISOString().slice(0, 7), start: stamp(start), end: stamp(end) };
}

async function monthlyViews(title: string) {
  const { month, start, end } = lastMonth();
  const response = await fetch('https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/en.wikipedia/all-access/user/' + encodeURIComponent(title.replace(/ /g, '_')) + '/monthly/' + start + '/' + end, { headers: WIKI, cache: 'no-store' });
  if (response.status === 404) return { month, views: 0 };
  if (!response.ok) throw new Error('Pageviews failed: ' + response.status);
  return { month, views: (await response.json()).items?.[0]?.views ?? 0 };
}

export async function judge(request: Request, promptId: string, title: string): Promise<Verdict> {
  const question = questions.find(q => q.id === promptId);
  if (!question) return { correct: false };
  const query = await wikipedia({ titles: title, prop: 'extracts|categories|description', exintro: '1', explaintext: '1', exchars: '1500', cllimit: '50', clshow: '!hidden' });
  const page = Object.values(query.pages ?? {})[0] as { missing?: string; title: string; description?: string; extract?: string; categories?: { title: string }[] } | undefined;
  if (!page || 'missing' in page) return { correct: false };
  const reply = await ask(request,
    'You judge a cricket trivia game. Decide whether the subject of the Wikipedia article is a correct answer to the prompt. Use the summary and categories as evidence, together with well-established facts. The subject itself must satisfy the prompt; being merely related to it is not enough. Reply YES or NO only.',
    'Prompt: ' + question.prompt + ' (' + question.hint + ')\nArticle: ' + page.title + (page.description ? ' — ' + page.description : '') + '\nSummary: ' + (page.extract ?? '') + '\nCategories: ' + (page.categories ?? []).map(c => c.title.replace('Category:', '')).join('; '));
  if (!/^yes/i.test(reply)) return { correct: false };
  const { month, views } = await monthlyViews(page.title);
  const rarity = 1 - (Math.log10(Math.min(Math.max(views, 50), 100000)) - Math.log10(50)) / (5 - Math.log10(50));
  return { correct: true, name: page.title.replace(/\s*\([^)]*\)$/, ''), points: Math.round(100 + 900 * rarity), views, month };
}
