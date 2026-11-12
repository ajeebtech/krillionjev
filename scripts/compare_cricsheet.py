#!/usr/bin/env python3
"""Produce reviewable IPL appearance candidates from Cricsheet match lineups.

Cricsheet data: https://cricsheet.org/; Open Data Commons Attribution License.
Inputs: data/cricsheet/ipl_json.zip and data/cricsheet/people.csv.
Output is a review report; this script does not overwrite game scores.
"""
import collections
import csv
import json
import re
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / 'data'
players = json.loads((DATA / 'players.json').read_text())
cache = json.loads((DATA / 'profile_cache.json').read_text())
normalize = lambda text: re.sub(r'[^a-z0-9]+', '', text.lower())
links = collections.defaultdict(set)
for name, urls in cache['profiles'].items():
    links[normalize(name)].update(urls)
registry = list(csv.DictReader((DATA / 'cricsheet/people.csv').open()))
by_source = collections.defaultdict(set)
for row in registry:
    if row.get('key_cricinfo'):
        by_source[row['key_cricinfo']].add(row['identifier'])
counts = collections.Counter()
years = collections.Counter()
with zipfile.ZipFile(DATA / 'cricsheet/ipl_json.zip') as archive:
    for path in archive.namelist():
        if not path.endswith('.json'):
            continue
        info = json.loads(archive.read(path))['info']
        years[info['dates'][0][:4]] += 1
        people = info.get('registry', {}).get('people', {})
        participants = {people[name] for team in info.get('players', {}).values() for name in team if name in people}
        counts.update(participants)

report = {'source': 'https://cricsheet.org/downloads/', 'register': 'https://cricsheet.org/register/', 'license': 'Open Data Commons Attribution License', 'method': 'Distinct match IDs whose official player list includes the identified player; not independently verified as equivalent to ESPN match appearances.', 'match_counts_by_year': dict(sorted(years.items())), 'players': []}
for player in players:
    urls = links.get(normalize(player['name']), set())
    source_id = player.get('sourcePlayerId')
    if not source_id and len(urls) == 1:
        m = re.search(r'-(\d+)/?$', next(iter(urls)))
        source_id = m.group(1) if m else None
    ids = by_source.get(str(source_id), set()) if source_id else set()
    if len(ids) != 1:
        continue
    cricsheet_id = next(iter(ids))
    count = counts.get(cricsheet_id, 0)
    if not count:
        continue  # Absence from the archive does not prove zero appearances.
    previous = player.get('appearances')
    report['players'].append({'name': player['name'], 'sourcePlayerId': source_id, 'cricsheetId': cricsheet_id, 'lineupCount': count, 'existingAppearances': previous, 'status': 'new' if previous is None else 'match' if count == previous else 'conflict'})
output = DATA / 'cricsheet/appearance_candidates.json'
output.write_text(json.dumps(report, indent=2) + '\n')
print('Matches:', sum(years.values()), 'Candidates:', len(report['players']))
print('Statuses:', dict(collections.Counter(p['status'] for p in report['players'])))
