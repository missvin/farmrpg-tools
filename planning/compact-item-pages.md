# Compact item-page contract

Approved October 5, 2026. Workstream: BL-357; ordered children: BL-358, BL-359, BL-360, BL-361.

## Default page

Keep saved inventory, mastery status, and the next unfinished Tower target together above Overview / Get more / Use it. Full Tower targets remain expandable. Overview shows linked direct recipe inputs, a shared target selector, remaining amount, and Plan materials. That action opens Get more without changing the target.

Default to the earliest unfinished Tower target, then the next mastery milestone, then custom quantity. Only offer mastery targets when eligibility is supported by the catalog, imported mastery, or Tower evidence; explicit non-masterable catalog metadata takes precedence. Preserve custom mastery for eligible items even after MM. Missing imported mastery is an explicit zero-baseline estimate, not known progress.

Secondary guidance and tool links stay collapsed. Saved production summaries use supported building references and saved queues, with no implication of live inventory or queue depletion. No capacity tracking or Fill inventory target is included.

## Get more

List supported source paths compactly, with estimates and expandable relevant details. Unowned reviewed chest sources are visible but are not counted as available supply.

Show target controls outside settings. Use one Ingredient / Needed / Counted supply / Shortfall table, starting with direct inputs. Individual Details controls reveal descendant requirements and sources; Expand all reveals all deeper requirements, and Collapse all restores direct inputs. Deeper rows are unique by canonical identity, carry whole-plan totals, and identify their parents. Expansion does not recalculate demand or consume supply again.

Reuse the shared goal, supply, and building planners. Compose building-source planning for demanded ingredients such as Pine Boards without altering the existing demand or supply totals. Show projected supply explicitly and keep relevant settings and explanations collapsed. Missing coverage remains warning-safe. Remove separate material-estimate cards and the redundant acquisition summary.

## Use it

Default to unfinished Tower craft uses, ordered by level and item name. Preserve separate targets and shared craft-matrix path evidence. Include a completed-target toggle and Quests / All recipes filters. Show supported progress, requirements, and per-output relationships without inventing total raw-material demand. Secondary tools and explanations are expandable.

## Acceptance

- At 1366 × 768, Steel and Fancy Violin show status, navigation, direct recipe and quick-plan action without scrolling, in light and dark themes.
- At 390px, every view and expanded material plan has no page-wide horizontal overflow.
- Target handoff and view switching preserve settings. Item navigation resets target, view and expansion state.
- Fancy Violin ingredient details include shared-engine Pine Board sawmill planning and saved queue context.
- Test quantity/mastery semantics, explicit non-masterability, missing snapshot/inventory, shared ingredients, cycles, expansion controls and use filters.
- Run focused tests, lint and production build; inspect local browser captures and keyboard behavior before marking the umbrella shipped.
- Landing each child requires safe repository helpers. Local acceptance does not confirm hosted deployment.

Browser acceptance uses an isolated test profile, not the user's browser-local data. Verification captures are kept in ignored local-data/item-page-verification.
