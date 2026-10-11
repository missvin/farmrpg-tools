# Original eighteen-item icon intake — 2026-10-11

Scope: exactly the eighteen names in `../new-items-2026-09-30-temp.csv`. The user authorized downloading available icons.

All eighteen Buddy pages matched their requested item names, and all eighteen observed image URLs returned HTTP 200 with an image/png content type. `observations.json` and `observations.csv` retain the source evidence.

The existing icon downloader processed these saved observations without fetching more Buddy pages: sixteen images downloaded, two existing local images reused (Pillow Case 02 and The Big One), zero failures or retries. Downloads were sequential with a three-second delay plus up to 500ms jitter. PNG signatures were verified for all eighteen local assets. `downloads.json` and `downloads.csv` retain the results.

The manifest gained exactly eighteen entries; all prior entries were checked for preservation. The temporary intake now records confirmed Buddy icons while preserving provisional IDs and other metadata. No files in `data/`, mastery eligibility, recipes, or source rates were changed.

Verification: 29 focused manifest/icon tests passed, lint passed, and the production build passed. The icon tests verify that all eighteen canonical names resolve to bundled assets. Hosted deployment has not been verified.

Backlog: BL-389.
