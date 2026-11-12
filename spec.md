# IPL Climb — product specification

Status: agreed first-release direction; implementation has not started  
Working name: IPL Climb

## Product

A mobile-first browser trivia game inspired by Krillion's rarity-based answers, reimagined as a minimalist hill climb. Each question shows two IPL franchises; the player names a cricketer who has been in the squads of both. Every correct answer earns height, with players who made fewer IPL match appearances carrying the player higher. The aim is to finish a seven-question climb as high as possible.

This is an independent game with its own name, visual assets and copy. The rarity-based premise is inspiration; use original assets and interface.

## First release

- A shared daily climb of seven questions, plus unlimited practice climbs.
- One player name per question, with 25 seconds to submit.
- Name autocomplete and tolerant matching; show a short result after each answer and a full climb summary at the end.
- Responsive, touch-friendly play on mobile and desktop; no account required.
- No extra hints, social sharing, leaderboards, accounts or admin editor in the first release. The two teams shown in the prompt are the clues.

## Game rules

1. A question reads “Name a player who was in the squads of both [Team A] and [Team B].” Both memberships must be present in the dataset; they do not have to be in the same season. The player need not have appeared in a match for either team.
2. Each question accepts multiple valid players, but a participant submits only one. Players may reuse a name across different questions if it is valid for each.
3. Start the 25-second countdown when the question is shown. Submitting locks the answer. A blank, invalid answer or timeout earns 0 m and advances after feedback. No retries or score penalty beyond the zero.
4. Show the accepted player's name, their height earned and IPL match appearance count, or explain that the answer was invalid or time ran out. Do not reveal the entire answer list during play. At the end, show each question, the submitted answer, result and height gained, plus total height.
5. Total height is the sum of the seven question scores; maximum 7,000 m. Animate the ascent after each question, including a clear textual height so motion is not needed to understand the score.

### Rarity and scoring

Use verified **career IPL match appearances** across all franchises as an objective proxy for obscurity. Fewer appearances mean a higher score. This measures playing experience, not popularity or player submission frequency. Squad membership remains the eligibility criterion, even for players with no IPL appearances.

For each question, rank all eligible answers with known appearance counts ascending. Equal counts share a rank and score. Let `N` be the number of eligible answers with known counts and `L` the number of those with strictly fewer appearances than the submitted player. Award `1000` m if `N = 1`; otherwise award `round(100 + 900 × (1 − L / (N − 1)))` m. The least experienced answers earn 1,000 m, and a unique most experienced answer earns 100 m. Ties can prevent any answer from landing at 100 m. Rankings are question-specific and fixed by the versioned dataset.

A verified zero is a valid count. An unknown count is not zero: accept a verified squad member, award the minimum 100 m, label the statistic unavailable, and exclude that player from `N` and `L`. Report missing counts for review before publishing questions.

### Input

- Autocomplete searches the entire player catalogue, not just eligible answers, so the suggestions do not reveal the solution set. Limit visible suggestions, support keyboard and touch selection, and do not auto-submit a selection.
- Normalize case, surrounding and repeated whitespace, punctuation and diacritics. Support explicitly verified aliases and reasonable typo matching when it resolves uniquely; if ambiguous, ask the player to choose a suggestion rather than guessing. Do not mark an ambiguous input correct automatically.
- Submitting an empty field is allowed and scores zero. The timer continues while searching or selecting.

## Daily and practice modes

- Daily: everyone receives the same ordered set for a given date, rotating at midnight Asia/Kolkata. Display the date and reset time. A versioned schedule and data snapshot keep questions and scores stable for the whole day.
- One completed daily attempt per date per browser/device, stored locally. Save progress after each question and restore it after reload; a running question's deadline continues in real time. Local storage is a convenience, not cheat prevention or a cross-device identity. If storage is cleared, the attempt cannot be recovered.
- Practice: generate seven distinct eligible team-pair questions from the published pool for each climb, allow unlimited replays, and keep practice separate from daily results. Avoid repeating a pair within a climb; randomize order. The same scoring and time rules apply.
- On returning to a completed daily climb, show its summary until the next reset. If a daily climb crosses midnight, finish against its original date and snapshot; the new day's game becomes available after completion.
- Use an absolute deadline so backgrounding or refreshing does not pause the timer. If the deadline passed while away, record a timeout on return. Do not start the next question's timer until the player explicitly continues from feedback.

## Data and content

The starting source is `/Users/jatin/Documents/iplteams/core/data/processed_players.json`, built from ESPN Cricinfo IPL squad pages by the existing Selenium scraper and processing pipeline. The inspected snapshot contains 1,024 player records across 2008–2026. Coverage describes the scraped data, not a guarantee that every squad is complete or that a player appeared in a match. Import a copy into this project; do not depend on the other local directory at runtime. Record source URLs, retrieval date, season coverage and any known gaps; verify rights and terms before redistribution or automated refresh.

Extend the existing scraper to capture each player's ESPNcricinfo profile URL and stable source ID from squad pages, visit each unique player's statistics page, and retrieve their career **IPL-specific match appearances**. Store the count alongside their team history, with profile/statistics URL, retrieval date and snapshot version. Verify the statistics view actually filters to IPL matches: a total for all T20 competitions is not an IPL count. Inspect the live pages and validate the extraction against known players before choosing selectors; availability of an IPL-specific count on each profile has not yet been verified.

The current scraper saves names and details but does not save profile IDs or appearance counts. Backfill stable IDs from squad pages and reconcile existing records; do not rely on names alone. Deduplicate player visits, cache successful results, use bounded retries and resumable checkpoints, and report missing pages, ambiguous identities and failed extraction. Keep failures as `null`, not zero; only record zero when supported by the source. Respect the source's access terms and verify redistribution rights. Version squad data, statistics and question sets together so scores remain reproducible.

- Use IPL squads only for this release, across available seasons. Include historical and defunct teams.
- Merge true franchise renames into one canonical team, retaining former names as aliases: Delhi Daredevils/Delhi Capitals, Kings XI Punjab/Punjab Kings, and Bangalore/Bengaluru Royal Challengers variants. Normalize Rising Pune Supergiant/Supergiants as one team. Keep distinct franchises distinct, including Deccan Chargers and Sunrisers Hyderabad, and Gujarat Lions and Gujarat Titans.
- Preserve per-season membership and source provenance. Use stable player and team IDs; names alone are not sufficient for disambiguation. Audit name-based deduplication in the existing processing script before importing.
- Generate eligible pairs from distinct canonical teams and their intersection of squad members. Require at least five valid players per pair to give meaningful choice. Review candidate pairs and data quality before publishing; do not infer membership from missing seasons. Daily sets should vary the teams and avoid the same pair twice. Maintain enough reviewed pairs for seven-question practice and scheduled daily climbs.
- Keep the dataset snapshot and schedule reproducible. Fix factual errors through a new version; do not silently change an active daily climb's answers or scores.

## Visual direction and experience

Make the game feel like a quiet, playful editorial sketch: a small character climbs a simple hill, with generous whitespace and crisp typography. Keep the interface restrained and the cricket question central. Working title: **IPL Climb**. The name and artwork can be refined during implementation.

- **Palette:** warm off-white background (`#F7F6F0`), near-black ink (`#20251F`), muted grass green (`#708B66`) and one deeper green (`#345B42`) for primary actions. Use a muted rust (`#B2573F`) for errors, with text labels as well as color. Check actual color combinations for accessible contrast.
- **Typography:** one clean, highly legible sans-serif family, with strong question headings, regular body text and tabular numerals for the timer and height. Use size and spacing for hierarchy rather than many decorative styles.
- **Hill and character:** original, simple vector or CSS shapes: a gently rising ridgeline, a small recognizable climber and a few sparse terrain marks. No detailed landscape, stock imagery or franchise logos are required. The character's position represents accumulated height on a fixed 0–7,000 m scale; avoid implying the summit is reached before 7,000 m.
- **Home:** compact wordmark, short explanation, a small hill illustration, a prominent Daily Climb button, and a quieter Practice button. Show today's date and next reset.
- **Question:** show progress (for example, `02 / 07`), height and a text countdown; present the two team names prominently above the player input. Keep the autocomplete and submit action clear, with the hill visible as supporting context. Display feedback in place with the player's name, match count and height gained, followed by a Continue button.
- **Summary:** show total height, the final character position and seven compact question results. Provide a practice action and, after a daily game, the next reset time.
- **Motion:** on a correct answer, the character makes a short upward hop along the slope, then settles at the new position; move it proportionally to height gained. Incorrect answers keep it in place. Use a subtle, quick transition and provide immediate static final positions when reduced motion is enabled. Text always communicates the result.
- **Responsive layout:** on narrow screens, stack progress, question, input and a compact hill; preserve room for mobile keyboards and autocomplete without hiding the submit button. On wider screens, place the question and hill side by side within a restrained maximum width. Use large touch targets and avoid horizontal scrolling.
- **Accessibility:** support keyboard navigation, screen readers, sufficient contrast, visible focus, reduced motion, and a timer conveyed through text as well as visuals. Do not rely on color alone for correctness. Test on current mobile Safari and Chrome as well as desktop browsers.

The direction is specified for implementation, but no visual mockup or final artwork has been created yet.

## Technical direction

Use Next.js, TypeScript and CSS, consistent with the related project and suitable for a responsive web app. Start with versioned local JSON for the player catalogue, question pool and daily schedule; no database or account infrastructure is required. A server-rendered or static deployment is acceptable, with client-side state persisted locally. Keep game rules and scoring in shared pure functions so they are independently testable. Client-side datasets and local attempt limits are inspectable and bypassable; competitive anti-cheat and hiding answer data are out of scope. Choose hosting when deployment is requested.

## Acceptance criteria

- A daily climb presents the same seven questions in the same order to different browsers for the same Kolkata date, and a new schedule is selected at the next reset.
- A valid player in both squads scores according to the formula; someone in only one squad, an invalid name, blank submission or timeout scores zero. Tied appearance counts score equally; verified zero and missing counts are handled differently.
- Search does not filter suggestions to valid answers. Normalized names and verified aliases work, and ambiguous typos cannot select the wrong player silently.
- Refresh or backgrounding preserves the attempt and does not extend a question deadline; completed daily results persist locally. Practice can be replayed without changing daily progress.
- The seven scores sum correctly to the displayed height, with a maximum of 7,000 m. Feedback and the final summary agree with the recorded answers and dataset version.
- Data validation catches duplicate IDs, invalid or duplicate team pairs, fewer than five eligible answers, invalid appearance counts, missing statistics and malformed schedules.
- Core flows work at mobile and desktop widths, using touch and keyboard; reduced-motion and screen-reader paths remain usable.

## Implementation sequence

1. Audit and normalize the existing squad dataset, identities and franchise aliases; document source coverage and gaps.
2. Extend the scraper to capture player IDs and IPL appearance counts, reconcile and validate the data, and generate reviewed question pools and a versioned daily schedule.
3. Implement scoring, matching, question selection and daily persistence, with tests for boundaries, ties, missing counts, expiry and date transitions.
4. Build the mobile-first game, feedback, hill climb and summary; verify accessibility and responsive behavior.
5. Run end-to-end checks for daily and practice play and review dataset quality before release.
