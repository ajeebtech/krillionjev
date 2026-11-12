# The IPL Climb

A mobile-first IPL squad trivia game built with Next.js. Run `npm install` and `npm run dev`, then visit http://localhost:3000.

## Data and preview status

The squad data was copied from `../iplteams/core/data/processed_players.json`. IPL match counts use ESPNcricinfo profile totals, Cricsheet match lineups, and explicit zeroes from IPL auction lists. Cricsheet data is attributed to [Cricsheet](https://cricsheet.org/) under the Open Data Commons Attribution License. Cricsheet lineup totals may differ from ESPN totals, so the sources are shown with answers. `data/cricsheet/coverage_audit.md` lists unresolved records and conflicts. The 193 previously unresolved players are assigned zero based on the project owner’s confirmation; these records carry the source `User-confirmed`. The 16 disagreements between ESPN and Cricsheet remain documented for review.

The resumable scraper in `scripts/scrape_appearances.py` discovers player links from the squad pages, fetches each unique profile, reads the aggregate IPL row's `Mat` column, and saves successful results alongside team data. Install its dependencies with `python3 -m pip install -r scripts/requirements.txt`, then run `python3 scripts/scrape_appearances.py`. It caches progress in `data/profile_cache.json`; `--limit N` limits profile lookups and `--skip-discovery` reuses discovered profiles. Missing rows are not assumed to be zero; ambiguous name matches are skipped. The extractor has been checked against live profiles in a visible Firefox session. If a verification page remains after loading, collection stops without recording a false count. Check source terms and access before running collection.
