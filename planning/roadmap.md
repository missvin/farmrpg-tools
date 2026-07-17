# Roadmap

This file is for milestone-level planning; use [backlog.csv](/C:/Users/liqui/Documents/farmrpg-tools/planning/backlog.csv) for the detailed backlog and dependencies.

## Completed Through v2.3

- `v1.5` established the core local tracker and Tower workflow
  - Tower requirements loading and read-only Tower view
  - import warning follow-ons for collapsed mastery exports
  - Tower hierarchy and detail-view polish
- `v1.6` expanded the app into broader local planning and usability
  - Tower Progress planning page and drilldowns
  - snapshot comparison
  - Sorted page planning rollups
  - import/reference-data maintenance polish
  - shared UI improvements such as Back to top and dark mode

## v1.7 (Complete)

- Planning foundations and durability
  - crafting rules, modifier handling, recursive ingredient burden, and ingredient-demand views
  - planner recipe exclusions and shared assumptions such as permanent saver and Iron Depot
  - acquisition-planning foundations for source taxonomy, planner state, owned stockpiles, stored pet inventory, and first-pass future pet forecasts
  - local snapshot history plus full backup export, restore, and restore safety
  - internal backlog-planning tooling including the backlog graph and overview mode

## v1.8 (Complete)

- Maintenance, enrichment, and hosted-readiness
  - paste-once Museum Tools refresh workflow with clearer follow-up metrics and unresolved triage
  - local item-icon observation, cache, and manifest workflow for later app-side icon use
  - header and navigation cleanup for the broader planning-tool shape
  - static Vercel hosting readiness while keeping saved user state browser-local

User-facing story:
The app is easier to keep current, easier to host as a local-first tool, and less noisy to maintain while broader acquisition-planning work remains sequenced in the backlog.

## v1.9 (Complete)

- Durability and trust cleanup
  - legacy snapshot-summary normalization for backup restore
  - action-oriented import trust summary

User-facing story:
The app is safer to migrate between local and hosted browser contexts, and import/restore flows give clearer confidence before the next planning surfaces expand.

## v1.10 (Complete)

- First acquisition answers and recommendations
  - reusable consumable estimates for Apple Cider, Lemonade, and Arnold Palmer
  - manual explore expected-value estimates from explicit local assumptions
  - first per-item acquisition breakdown view
  - compact source recommendations with provenance details

User-facing story:
You can start asking not just "what do I need to craft?" but "what are my practical acquisition paths for this item under my current assumptions, and why?"

## v2.0 (Complete)

- Target-output planning workspace
  - target-output planning domain model (shipped)
  - corrected pet-source forecasting before future pet supply feeds the shared pool (shipped)
  - normalized shared available-supply layer with override rules (shipped)
  - recursive remaining-requirement engine (shipped)
  - multi-target shared-demand support (shipped)
  - first target-output planning page (shipped)

User-facing story:
You can choose one or more target outputs and see what is still required after pooled available supply is consumed across the whole planning problem.

## v2.1 (Complete)

- Richer recursive planning workflow
  - current inventory import as an available-supply source (shipped)
  - graph-ready recursive planning tree derivation (shipped)
  - recursive planning graph/tree visualization (shipped)
  - target-output planning explainability (shipped)

User-facing story:
The target-output planner becomes easier to feed with real inventory data and easier to understand when plans become large or overlapping.

## v2.2 (Complete)

- Item-level goal and source planning
  - item profile goal calculator workstream (`BL-235`, in progress as an umbrella; v2.2 calculator scope shipped)
  - reviewed openable contents as optional sources (`BL-236`, shipped)
  - recursive passive-source modeling for pets, Crunchy Omelette collection, and Tower-artifact recurring inputs (`BL-237`, shipped)
  - Wishing Well expected-value source modeling (`BL-238`, shipped)
  - cache-first Buddy item-page evidence workflow (`BL-243`, shipped), initial reviewed seed cache (`BL-247`, shipped), current 1,461-item museum universe refresh (`BL-248`, shipped), initial full current-universe Buddy cache population (`BL-249`, shipped), artifact-completeness repair/readiness validation (`BL-253`, shipped), and freshness/recheck controls (`BL-244`, shipped)
  - multi-source Buddy item-page parser and reviewed promotion fan-out (`BL-245`, `BL-246`, shipped), current-universe icon refresh (`BL-250`, shipped), and source promotion umbrella (`BL-251`, shipped) split into shipped recipe promotion (`BL-259`), drop-rate (`BL-260`), shipped openable guardrail, fixed-content promotion, and random openable expected-value promotion (`BL-261`, `BL-262`, `BL-269`), source-hint (`BL-263`), alias (`BL-264`), and completion-audit (`BL-265`) child rows
  - full reviewed pet-source coverage for normal and seasonal pets (`BL-242`, shipped)
  - item-page mastery and quantity goal calculator foundation (`BL-239`, shipped)
  - wait-days and remaining source-budget mode (`BL-240`, shipped)
  - item goal calculator UI and explainability (`BL-241`, shipped)

User-facing story:
Item pages should answer practical questions like how long Salt, Large Nets, Frost Snapper Shells, or Spiked Shells will take when current inventory, stored pets, future pets, openables, Wishing Well throws, recursive recipes, and active gathering sources all matter.

## v2.3 (Complete)

- Quest history, future-demand, and questline planning
  - completed-request parser, local quest-history snapshots, and first rarity/population analytics (`BL-271`, `BL-272`, `BL-273`, shipped)
  - broader reviewed quest-universe coverage for reliable history matching (`BL-274`, shipped)
  - questline and seasonal progress model (`BL-275`, shipped)
  - item-page future quest demand adapter for known unfinished requirements (`BL-276`, shipped)
  - source-rate assumptions for prep-time planning (`BL-280`, shipped) and quest source-burden estimates (`BL-281`, shipped)
  - prep-time-based scary watch scoring and explainability controls (`BL-282`, `BL-283`, shipped)
  - shared source allocation scenarios for multi-goal what-if planning (`BL-284`, shipped)
  - Quest History import review and dashboard UI (`BL-277`, shipped)
  - questline heatmap and bottleneck explorer (`BL-278`, shipped)

User-facing story:
Completed quest exports become useful planning data: you can review imports, see rare completions and community movement, understand questline progress, and connect future quest requirements back to item pages and hoard-worthy bottlenecks. Scary future items should be based on source burden and prep time, not raw required quantity alone.

## Completed After v2.3

- Goal-and-item workbench information architecture
  - navigation regrouped around Home, Goals, Items, Planning, Data, and Advanced
  - compatibility redirects preserve existing routes and bookmarks
  - Home, Goals, Items, and Data entry surfaces connect existing workflows without removing pages
  - route metadata and action-oriented search aliases provide consistent labels and discovery
- Focused planning expansion
  - dynamic craft-material and Tower color matrix views
  - farm-building production assumptions and item-goal source integration
  - Tower cutoff Pumpkin Juice planning and item-goal source relevance cleanup
- Reference maintenance and history usability
  - repeatable cache-first new-item intake with a reviewed June 2026 promotion batch
  - readable Item Velocity dates and historical point tooltips
  - reusable price-check paste normalization as the foundation for later trade-value features

User-facing story:
The app now behaves as a goal-and-item workbench rather than a loose collection of tools, while preserving familiar routes and local data. Item planning reaches more source types, new reference items have a repeatable review path, and historical progress is easier to inspect.

## Later

- Trade-price and valuation workflow
  - reviewed giveable/tradeable item tagging
  - compact item-page trade-price context
  - explicit currency-conversion assumptions and local inventory valuation
  - optional dated price history after the current-price workflow proves useful
- Focused planning follow-ups
  - per-zone Apple Cider effectiveness and optional temporary meal modifiers
  - acquisition context for named missing Museum items
  - Tower method filtering when method metadata is trustworthy enough
- Trust, performance, and workflow polish
  - alternate rating-source selection after reviewed ClientCoin rows are populated
  - item-icon manifest chunk optimization if the build warning remains isolated there
  - shipped-version release tracking in the backlog/changelog workflow
  - stable backlog row ordering maintenance
  - Tower requirement data refreshes as confirmed values are released
- Deeper identity work when planning breadth truly requires it
  - stronger canonical item identity

## Icebox

- Community process features
  - community feature request intake
  - community voting workflow
- Optional modeling and maintenance ideas
  - crop-row-aware seed drop-rate modeling
  - manual difficulty rating overrides
  - reviewed method-update export workflow
