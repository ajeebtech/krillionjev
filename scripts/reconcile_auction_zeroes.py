#!/usr/bin/env python3
"""Apply explicit pre-2025 IPL zeroes where there are no later squad seasons.

Exact unique name, one ESPN profile, explicit 0 in the official auction list,
and a last recorded squad year of 2024 or earlier are all required. An empty
auction cell is not treated as zero. Later squads require separate verification.
"""
import collections, json, re
from pathlib import Path
D = Path(__file__).resolve().parent.parent / 'data'
path = D / 'players.json'
players = json.loads(path.read_text())
rows = json.loads((D / 'ipl_auction_2025.json').read_text())
profiles = json.loads((D / 'profile_cache.json').read_text())['profiles']
normal = lambda s: re.sub(r'[^a-z]', '', s.lower())
names = collections.defaultdict(list)
links = collections.defaultdict(set)
for row in rows: names[normal(row['first'] + ' ' + row['last'])].append(row)
for name, urls in profiles.items(): links[normal(name)].update(urls)
changed = []
for player in players:
    if player.get('appearances') is not None: continue
    key = normal(player['name']); choices = names[key]; urls = links[key]
    years = [int(year) for team in player['teams'] for year in team['years']]
    if len(choices) != 1 or choices[0]['ipl_matches'] != '0' or len(urls) != 1 or not years or max(years) > 2024: continue
    url = next(iter(urls)); match = re.search(r'-(\d+)/?$', url)
    if not match: continue
    player.update(appearances=0, appearanceSource='IPL auction list 2025', appearanceSourceUrl='https://documents.iplt20.com/bcci/documents/1731674068078_TATA%20IPL%202025-%20Auction%20List%20-15.11.24.pdf', sourcePlayerId=match.group(1), profileUrl=url, statsRetrievedAt='2026-11-10')
    changed.append(player['name'])
path.write_text(json.dumps(players, indent=2, ensure_ascii=False) + '\n')
print('Applied',len(changed),'zeroes:', ', '.join(changed))
