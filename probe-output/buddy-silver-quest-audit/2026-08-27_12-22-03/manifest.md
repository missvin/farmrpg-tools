# Audit Manifest

## Policy and request log

| Sequence | URL | Status | Wait before request | Outcome |
|---:|---|---:|---:|---|
| 1 | `https://buddy.farm/robots.txt` | 200 | 10 s | Readable; no standard crawl directives. |
| 2 | `https://buddy.farm/sitemap.xml` | 404 | 8 s | No sitemap published at standard route. |
| 3 | `https://buddy.farm/` | 200 | 8 s | Homepage contains five current quest links only; no index. |
| 4 | `https://buddy.farm/q/` | 404 | 9 s | No quest collection index. |
| 5 | `https://buddy.farm/ql/` | 404 | 9 s | No questline collection index. |

All Buddy requests were sequential and used the review-only user agent `FarmRPGToolsReviewAudit/1.0 (+local review-only)`. No item pages, assets, FarmRPG pages, third-party pages, questline pages, or individual quest pages were requested.

## Artifact hashes (SHA-256)

| Relative path | SHA-256 |
|---|---|
| `raw/robots-response.txt` | `117F134118A1C7D562037CF1B940C25F3C8259EAC105E98419F99B551FD6705F` |
| `raw/sitemap.xml` | `4C0DCA3858E7A3EC4BAD0F8230A8004041E0F98D911D145BAEF43B999A7924E6` |
| `raw/homepage.html` | `900A465DBC40600A7FB69346B7D8D3D1E7FB4878B89D34C290FC2065D2902E93` |
| `raw/quest-index.html` | `4C0DCA3858E7A3EC4BAD0F8230A8004041E0F98D911D145BAEF43B999A7924E6` |
| `raw/questline-index.html` | `4C0DCA3858E7A3EC4BAD0F8230A8004041E0F98D911D145BAEF43B999A7924E6` |

The corresponding response-header files are stored beside each raw body. Fetch dates are retained in their HTTP `Date` headers.

## Coverage totals

```text
discovered_questlines=0
inspected_questlines=0
candidate_quest_pages=0
successfully_parsed_pages=0
cache_hits_for_silver_values=0
service_or_discovery_failures=3
ambiguous_quest_pages=0
```

## Parser warnings

- The standard sitemap and both natural index routes rendered Buddy's 404 page.
- The homepage is not a complete questline index.
- Existing cache data was read only to assess reuse potential; it was insufficient for currency amounts and was not treated as a URL-discovery authority.
- No parser was created or run because no allowed candidate questline URL set was available.
