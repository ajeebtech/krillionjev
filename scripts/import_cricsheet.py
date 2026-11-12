#!/usr/bin/env python3
"""Merge ID-matched Cricsheet lineup counts, preserving known ESPN totals."""
import json
from pathlib import Path

root = Path(__file__).resolve().parent.parent
path = root / 'data/players.json'
players = json.loads(path.read_text())
report = json.loads((root / 'data/cricsheet/appearance_candidates.json').read_text())
candidates = {p['name']: p for p in report['players']}
for player in players:
    candidate = candidates.get(player['name'])
    if player.get('appearances') is not None:
        player.setdefault('appearanceSource', 'ESPNcricinfo')
    if not candidate:
        continue
    player['sourcePlayerId'] = candidate['sourcePlayerId']
    player['cricsheetId'] = candidate['cricsheetId']
    if player.get('appearances') is None:
        player['appearances'] = candidate['lineupCount']
        player['appearanceSource'] = 'Cricsheet'
        player['statsRetrievedAt'] = '2026-11-10'
path.write_text(json.dumps(players, indent=2, ensure_ascii=False) + '\n')
print('Known counts:', sum(p.get('appearances') is not None for p in players), '/', len(players))
