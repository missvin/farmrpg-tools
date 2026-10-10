# Bounded nine-item icon pull — BL-387

On 2026-10-10 the user authorized a polite pull for exactly the nine missing icons found beside BL-386's repaired recipes.

Fetched nine Buddy page-data documents sequentially, requiring exact item-name matches and item image paths. Saved only icon observations, not unrelated page data. Used the existing guarded downloader and manifest derivation/merge helpers. Requests were spaced by three seconds, with up to 500ms additional jitter between image downloads. No retries, discovery crawl or other item pulls occurred.

Results: nine page reads and nine image downloads; zero failures; nine valid PNG files, all visually reviewed. Manifest readiness and bundled icon lookup pass for all nine. All preexisting manifest entries were preserved exactly. No catalog, recipes, eligibility, availability or source rates changed.

- Pestle and Mortar
- Cave Paste
- Ocean Stone
- Ancient Bird Fossil
- Ancient Ram Fossil
- Flarite Ring
- Green Halite Ring
- Green Halite Earrings
- Sparkle Dust

`observations.json`/`.csv` retain exact source URLs and image references. `downloads.json`/`.csv` retain the downloader results and request metrics. Tests: 11 focused icon/manifest tests, lint and production build. Hosted deployment was not verified.
