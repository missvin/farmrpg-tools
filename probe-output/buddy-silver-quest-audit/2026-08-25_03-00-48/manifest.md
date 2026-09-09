# Audit Manifest

## Scope and policy outcome

- Audit scope: only Buddy `robots.txt`, then (if allowed) Buddy-provided questline and quest URLs.
- Quest, questline, item, asset, FarmRPG, and third-party pages fetched: none.
- Robots policy request URL: `https://buddy.farm/robots.txt`
- Robots fetch time: `2026-08-25T10:01:19Z`
- Result: HTTP 301 with a self-referential `Location` header; policy body unavailable.
- Decision: stopped before discovery/crawl because the policy could not be interpreted safely.

## Artifacts

| Relative path | Evidence type | Source URL | Fetch time | Notes |
|---|---|---|---|---|
| `raw/robots-redirect-headers.txt` | response headers | `https://buddy.farm/robots.txt` | 2026-08-25T10:01:19Z | Self-redirect; no policy body. |
| `silver-quest-requests-at-least-100-billion.csv` | requested result CSV | n/a | 2026-08-25T10:01:19Z | Header only; no allowed evidence. |
| `summary.md` | audit conclusion | n/a | 2026-08-25T10:01:19Z | Provisional, stopped. |

## SHA-256

- `raw/robots-redirect-headers.txt`: `61DA613C2D268959A91B4C254844082B7904CB0F260FDC3F8BFEE562FA4183DA`
- `silver-quest-requests-at-least-100-billion.csv`: `1D3F0C84F65D88FCD348F21E21347B6B9F0E1BBE3A9E3CBEF2BB03D5DAF5D18E`
- `summary.md`: `23B502C2F339E9CBA15A0AAE28D53F7D012792957DFC8DEEB670AD8F21524E8A`

## Coverage totals

discovered_questlines=0
inspected_questlines=0
candidate_quest_pages=0
successfully_parsed_pages=0
cache_hits=0
failures=1
ambiguous_pages=0

## Parser warnings

- `robots.txt` response was a redirect loop, so no crawl-delay or allow/disallow directives could be read.
- No parser was created or run.
