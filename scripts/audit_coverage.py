#!/usr/bin/env python3
"""List unresolved players and mismatched source counts for review."""
import collections, csv, json, re, zipfile
from pathlib import Path
D = Path(__file__).resolve().parent.parent / 'data'
players = json.loads((D / 'players.json').read_text())
report = json.loads((D / 'cricsheet/appearance_candidates.json').read_text())
profiles = json.loads((D / 'profile_cache.json').read_text())['profiles']
normal = lambda s: re.sub(r'[^a-z0-9]', '', s.lower())
links = collections.defaultdict(set)
for name, urls in profiles.items(): links[normal(name)].update(urls)
by_id = collections.defaultdict(set)
with (D / 'cricsheet/people.csv').open() as f:
    for row in csv.DictReader(f):
        if row.get('key_cricinfo'): by_id[row['key_cricinfo']].add(row['identifier'])
counts = collections.Counter()
with zipfile.ZipFile(D / 'cricsheet/ipl_json.zip') as archive:
    for path in archive.namelist():
        if not path.endswith('.json'): continue
        info = json.loads(archive.read(path))['info']
        identities = info.get('registry', {}).get('people', {})
        counts.update({identities[n] for team in info.get('players', {}).values() for n in team if n in identities})
groups = collections.defaultdict(list)
for player in players:
    if player.get('appearances') is not None: continue
    urls = links.get(normal(player['name']), set())
    source_id = player.get('sourcePlayerId')
    if not source_id and len(urls) == 1:
        found = re.search(r'-(\d+)/?$', next(iter(urls)))
        source_id = found.group(1) if found else None
    if len(urls) > 1 and not source_id: category = 'Ambiguous ESPN profile identities'
    elif not source_id: category = 'No ESPN profile ID found'
    elif len(by_id.get(source_id, set())) != 1: category = 'ESPN ID not uniquely linked in Cricsheet register'
    elif not counts[next(iter(by_id[source_id]))]: category = 'Linked player has no IPL lineup in archive'
    else: category = 'Needs further investigation'
    groups[category].append(player['name'])
lines = ['# IPL appearance coverage audit', '', 'Snapshot: 10 November 2026. Missing lineup records do not prove zero IPL appearances. ESPN ID links and match lineups are from Cricsheet; existing ESPN counts are retained when sources disagree.', '']
for category, names in groups.items():
    lines += [f'## {category} ({len(names)})', ''] + [f'- {name}' for name in sorted(names)] + ['']
conflicts = [p for p in report['players'] if p['status'] == 'conflict']
lines += [f'## ESPN and Cricsheet count differences ({len(conflicts)})', '', '| Player | ESPN | Cricsheet lineups |', '| --- | ---: | ---: |']
lines += [f"| {p['name']} | {p['existingAppearances']} | {p['lineupCount']} |" for p in conflicts]
(D / 'cricsheet/coverage_audit.md').write_text('\n'.join(lines) + '\n')
print('Unresolved:', sum(map(len, groups.values())), 'Conflicts:', len(conflicts))
