"""Build scored cricket prompts from Wikidata answers and Wikipedia pageviews.

Usage: python3 scripts/build_prompts.py [YYYY-MM] [--only id,id]
Reads data/prompts/definitions.json and writes data/prompts/built.json.
Each answer's rarity comes from its English Wikipedia article's user pageviews
in the given month (default: the last complete month).
"""
import calendar
import json
import re
import sys
import time
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DEFINITIONS = ROOT / 'data/prompts/definitions.json'
OUTPUT = ROOT / 'data/prompts/built.json'
HEADERS = {'User-Agent': 'ipl-climb-prompt-builder/0.1 (https://github.com/ajeebtech/krillionjev)'}
MIN_ANSWERS = 5


def fetch(url, data=None, tries=4):
    for attempt in range(tries):
        try:
            request = urllib.request.Request(url, data=data, headers=HEADERS)
            with urllib.request.urlopen(request, timeout=60) as response:
                return json.load(response)
        except urllib.error.HTTPError as error:
            if error.code == 404:
                return None
            if error.code == 400:
                raise ValueError(error.read().decode(errors='replace')[:600]) from error
            if attempt == tries - 1:
                raise
            if error.code == 429:
                time.sleep(int(error.headers.get('Retry-After', '60')))
        except (urllib.error.URLError, TimeoutError, ConnectionError):
            if attempt == tries - 1:
                raise
        time.sleep(2 ** attempt)


def category_answers(prompt):
    pending, seen, answers = ['Category:' + prompt['category']], set(), {}
    excluded = set(prompt['exclude'])
    while pending:
        category = pending.pop()
        if category in seen:
            continue
        seen.add(category)
        params = {'action': 'query', 'format': 'json', 'generator': 'categorymembers', 'gcmtitle': category, 'gcmlimit': 'max', 'gcmtype': 'page|subcat', 'prop': 'pageprops', 'ppprop': 'wikibase_item'}
        while True:
            data = fetch('https://en.wikipedia.org/w/api.php?' + urllib.parse.urlencode(params))
            for page in (data or {}).get('query', {}).get('pages', {}).values():
                if page['ns'] == 14 and 'cricket' in page['title'].lower() and len(seen) < 25:
                    pending.append(page['title'])
                qid = page.get('pageprops', {}).get('wikibase_item')
                if page['ns'] == 0 and qid and qid not in excluded:
                    answers[qid] = {'id': qid, 'name': re.sub(r'\s*\([^)]*\)$', '', page['title']), 'article': page['title'], 'aliases': []}
            if 'continue' not in (data or {}):
                break
            params.update(data['continue'])
    return list(answers.values())


def query_answers(prompt):
    if 'category' in prompt:
        return category_answers(prompt)
    values = ' '.join('wd:' + qid for qid in prompt['include'])
    include = f'UNION {{ VALUES ?item {{ {values} }} }}' if values else ''
    sparql = f"""
SELECT ?item ?itemLabel ?article (GROUP_CONCAT(DISTINCT ?alt; separator="|") AS ?aliases) WHERE {{
  {{ {prompt['where']} }} {include}
  ?article schema:about ?item ; schema:isPartOf <https://en.wikipedia.org/> .
  OPTIONAL {{ ?item skos:altLabel ?alt . FILTER(LANG(?alt) = "en") }}
  SERVICE wikibase:label {{ bd:serviceParam wikibase:language "en". }}
}} GROUP BY ?item ?itemLabel ?article"""
    body = urllib.parse.urlencode({'query': sparql, 'format': 'json'}).encode()
    rows = fetch('https://query.wikidata.org/sparql', data=body)['results']['bindings']
    excluded = set(prompt['exclude'])
    answers = {}
    for row in rows:
        qid = row['item']['value'].rsplit('/', 1)[1]
        if qid in excluded:
            continue
        title = urllib.parse.unquote(row['article']['value'].rsplit('/wiki/', 1)[1]).replace('_', ' ')
        name = re.sub(r'\s*\([^)]*\)$', '', title)
        label = row['itemLabel']['value']
        aliases = sorted({a for a in row.get('aliases', {}).get('value', '').split('|') if a} | ({label} if label != qid else set()) - {name})
        answers[qid] = {'id': qid, 'name': name, 'article': title, 'aliases': aliases}
    return list(answers.values())


def monthly_views(title, month):
    year, number = map(int, month.split('-'))
    start, end = f'{year:04d}{number:02d}01', f'{year:04d}{number:02d}{calendar.monthrange(year, number)[1]}'
    article = urllib.parse.quote(title.replace(' ', '_'), safe='')
    url = f'https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/en.wikipedia/all-access/user/{article}/monthly/{start}/{end}'
    data = fetch(url)
    return data['items'][0]['views'] if data and data.get('items') else 0


def last_complete_month():
    today = date.today()
    year, month = (today.year, today.month - 1) if today.month > 1 else (today.year - 1, 12)
    return f'{year:04d}-{month:02d}'


def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    only = next((a.split('=', 1)[1] for a in sys.argv[1:] if a.startswith('--only=')), None)
    month = args[0] if args else last_complete_month()
    definitions = json.loads(DEFINITIONS.read_text())['prompts']
    previous_build = json.loads(OUTPUT.read_text()) if OUTPUT.exists() else {'month': None, 'prompts': []}
    previous = {p['id']: p for p in previous_build['prompts']}
    known_views = {a['article']: a['views'] for p in previous_build['prompts'] for a in p['answers']} if previous_build['month'] == month else {}
    built = []
    for prompt in definitions:
        if only and prompt['id'] not in only.split(','):
            if prompt['id'] in previous:
                built.append(previous[prompt['id']])
            continue
        try:
            answers = query_answers(prompt)
        except ValueError as error:
            print(f"{prompt['id']:<24} query rejected: {error}", flush=True)
            continue
        with ThreadPoolExecutor(max_workers=8) as pool:
            for answer, views in zip(answers, pool.map(lambda a: known_views[a['article']] if a['article'] in known_views else monthly_views(a['article'], month), answers)):
                answer['views'] = views
        answers.sort(key=lambda a: (-a['views'], a['name']))
        status = 'ok' if len(answers) >= MIN_ANSWERS else 'too few answers, skipped'
        print(f"{prompt['id']:<24} {len(answers):>5} answers  top: {', '.join(a['name'] for a in answers[:3])}  [{status}]", flush=True)
        if len(answers) >= MIN_ANSWERS:
            built.append({'id': prompt['id'], 'prompt': prompt['prompt'], 'hint': prompt['hint'], 'answers': answers})
            OUTPUT.write_text(json.dumps({'month': month, 'source': 'Wikidata answers, English Wikipedia user pageviews', 'prompts': built}, ensure_ascii=False, separators=(',', ':')) + '\n')
    print(f'wrote {len(built)} prompts for {month} to {OUTPUT.relative_to(ROOT)}')


if __name__ == '__main__':
    main()
