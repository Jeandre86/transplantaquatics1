# Transplant swimming review export

`data/swimming/swimmers.json` is the review artifact. It is not connected to Supabase, and these scripts have no database write operation. `data/swimming/review-summary.json` provides counts, source coverage and review-flag totals without the full result list.

## Scope and coverage

Seven source groups are tracked: WTG, Australia, USA, Canada, Britain, South Africa and Europe. Current coverage is **partial**, not every historical edition. Consult `source_groups` for years and `coverage` for individual source counts. South Africa returned a security page, and the linked USA 2024 results host was unavailable during retrieval. Other missing years were not found in the retrieved archives; absence from the export does not mean no games occurred.

`source_inventory` includes retrieved archive pages, result documents, supplementary documents and failed downloads. `sources` includes only documents with extraction adapters. Record-only documents are not treated as complete competition results. The export does not verify or update world records.

## Review structure

- `swimmers`: provisional identities with original name variants, country when established, teams, years, categories and nested individual results. These are **not accounts or database profiles**.
- `relay_results`: team performances and source member names. Members are linked to a swimmer only when the same meet and country/team identify a unique match. Unlinked relay members remain here for identity review; they are not silently assigned to an athlete.
- `identity_review`: possible same-name matches that could not safely be merged. Entries are review cases, not a count of distinct duplicated people.
- `unparsed_rows`: source text that needs manual extraction.
- Every extracted result retains source URL, PDF page and original row, along with the original time/status and interpreted milliseconds. Event details include stroke, distance/unit, gender, source age category and pool course when known. Additional source details such as splits, medals, points, competitor identifiers and birth year are retained when available.

Exact normalized name plus country/team and compatible age evidence is the automatic merge rule. Conflicting ages/genders remain separate. Complete surname-first names can be reconciled when name tokens, country, gender and birth-year evidence agree. Partial names, changed surnames and spelling differences can still represent duplicate people and need review. IDs are deterministic for an unchanged input set; do not use them as permanent production identity keys before reconciliation.

Unknown information remains null or a flagged missing source value. Competition eligibility is not an inferred transplant type. Canadian category codes remain in `category_original` until their definitions are confirmed. The Canadian 500m triathlon swimming legs are explicitly categorized as `triathlon_swim_leg`. The 2019 WTG age column uses category placeholders and is retained as source text rather than an exact age. Pool course, OCR, source name order and suspicious time values have explicit flags. A source listing or record annotation is not independent verification.

Review `identity_review`, `unparsed_rows` and `review_flags` before importing. In particular, the scanned 2013/2015 books require visual review. The export deliberately sets `ready_for_database_import` to false.

## Reproduce

From the repository root, with Python 3.11+:

```sh
python3 -m venv scripts/swimmer_scraper/.venv
scripts/swimmer_scraper/.venv/bin/pip install -r scripts/swimmer_scraper/requirements.txt
scripts/swimmer_scraper/.venv/bin/python scripts/swimmer_scraper/fetch_sources.py --manifest data/swimming/swimmers.json
```

Downloads use verified TLS and cache source SHA-256 hashes and retrieval metadata. They run serially and reuse successful cached files. PDFs and intermediate extraction/OCR caches are gitignored; the final JSON and source metadata are retained. A site security page is not bypassed.

The 2013 and 2015 WTG PDFs are scanned. On macOS, create local OCR caches before rebuilding:

```sh
swiftc scripts/swimmer_scraper/ocr.swift -o /tmp/swimmer-ocr
/tmp/swimmer-ocr data/swimming/sources/fc4cd487226f9d06b70f.pdf data/swimming/sources/fc4cd487226f9d06b70f 72 90
/tmp/swimmer-ocr data/swimming/sources/7d2898902f98b7bb3c35.pdf data/swimming/sources/7d2898902f98b7bb3c35 98 126
```

Then generate and validate offline:

```sh
scripts/swimmer_scraper/.venv/bin/python scripts/swimmer_scraper/build_export.py
scripts/swimmer_scraper/.venv/bin/python -m unittest discover -s scripts/swimmer_scraper -p 'test_*.py'
```

The tests cover time interpretation, seed/final selection, missing team columns, identity collisions, gender/event transitions, swimming page boundaries, placeholder ages, unique IDs and source/member references. They do not certify every source row as correct.

## Add another source

Fetch an explicitly selected public URL with `fetch_sources.py URL`. Register its cached source ID and meet metadata in `spec()` in `build_export.py`, then select or add a parser for its actual layout. Add a fixture for new layout behavior and regenerate the artifact. Unknown sites and layouts are not automatically guessed or imported. This is a source-adapter pipeline, not a universal parser for arbitrary websites.
