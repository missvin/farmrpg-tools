# Roadmap

This file is for milestone-level planning; use [backlog.csv](/C:/Users/liqui/Documents/farmrpg-tools/planning/backlog.csv) for the detailed backlog and dependencies.

## Completed Through v1.10

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

## v2.0

- Target-output planning workspace
  - target-output planning domain model
  - corrected pet-source forecasting before future pet supply feeds the shared pool
  - normalized shared available-supply layer with override rules
  - recursive remaining-requirement engine
  - multi-target shared-demand support
  - first target-output planning page

User-facing story:
You can choose one or more target outputs and see what is still required after pooled available supply is consumed across the whole planning problem.

## v2.1

- Richer recursive planning workflow
  - current inventory import as an available-supply source
  - graph-ready recursive planning tree derivation
  - recursive planning graph/tree visualization
  - target-output planning explainability

User-facing story:
The target-output planner becomes easier to feed with real inventory data and easier to understand when plans become large or overlapping.

## Later

- Focused planning and workflow polish
  - shipped-version release tracking in the backlog/changelog workflow
  - stable backlog row ordering maintenance
  - selected item-icon integration into app views
  - Tower requirement data refreshes as confirmed values are released
- Optional enrichment
  - buddy slug enrichment and related reference-maintenance workflows
  - unmatched export helpers where they materially improve maintenance
- Deeper identity work when planning breadth truly requires it
  - stronger canonical item identity
  - alias support and registry groundwork

## Icebox

- Community process features
  - community feature request intake
  - community voting workflow
- Deferred import/docs ideas
  - mastery export help page with an import-screen link
