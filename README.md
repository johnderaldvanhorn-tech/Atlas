# ATLAS — Engineering & Innovation Management v8.2.2

## v8.0.0 — Phase 1 terminology and navigation

- Renamed Projects to **Product Initiatives** throughout the user interface.
- Renamed Roadmap to **Initiative Roadmap**.
- Renamed Development to **Development Support**.
- Renamed the application to **ATLAS — Engineering & Innovation Management**.
- Updated dashboard headings, drawers, buttons, filters, reports, exports, and explanatory text.
- Preserved existing Supabase table names and internal identifiers for backward compatibility.


## v7.1.9

- Removed the unused Execution navigation item and any orphaned Execution view references.
- Updated all application asset references to v7.1.9.



## v7.0.9

- Added **Sustained — Bugs and Defects** as the fourth portfolio category.
- Added Sustained to project creation and editing, portfolio filters, CSV import/export validation, dashboard Project Mix, roadmap metadata, and reports.
- Added a fourth dashboard Project Mix card with total and Approved / Active counts.
- Kept existing NPD, CI, and legacy DPT/Skunkworks records fully compatible.


## v7.0.2

- Supabase is the project system of record for project persistence.
- Added the v7.0.2 Supabase migration and release notes.
- Added Mac-to-Pi release automation for `pi@jan3-server`.
- Runs as a static application on port 5173 using Python's HTTP server.
- Cloudflare publishes the application at `project.theburrowfarm.com`.
- Aligned visible badges, package metadata, cache-busting references, and release scripts.

## Supabase connection repair

This release fixes the error:

`Cannot read properties of undefined (reading 'createClient')`

The application now includes a local, browser-safe Supabase REST client in `supabase-client.js`. It does not depend on an external CDN and works with the existing static Python web server.

### Included

- Bundled `createClient()` implementation for the Supabase PostgREST API
- Project, resource, assignment, governance, execution, and report persistence support
- Saved connection restoration on page load
- Improved invalid URL, key, network, table, and RLS error messages
- Local Storage fallback remains available
- Version aligned across the application and release tooling at 7.0.2

### Run locally

```bash
python3 -m http.server 5173
```

### Supabase setup

Run `supabase/schema.sql` in the Supabase SQL Editor before selecting **Connect and Sync**.

Use a publishable or anon key only. Never put a service-role key in this browser application.


## v0.6.33
- Fixed Sales / Marketing Price / Lift persistence.
- CSV import/export now maps Price / Lift to the visible per-unit value.
- Migrates legacy priceLift values without double-counting revenue.


## v7.0.7

- Fixed Product Initiatives filters so dropdown values refresh from the current Supabase project table after data loads.
- Preserved selected filters when project data changes and reset selections that no longer exist.
- Rebuilt fiscal-quarter choices from the current portfolio after load, save, import, or reconnect.

## v7.0.3

- Added dashboard Project Mix cards for NPD, Continuous Improvement, and Skunkworks.
- Each card shows total projects and the approved/active subset.
- Preserved legacy DPT category storage while displaying it as Skunkworks.

## v7.0.3

- Added a dashboard Project Mix summary for NPD, CI, and Skunkworks projects.
- Added Approved / Active counts for each delivery model.
- Preserved the existing DPT database category while displaying it as Skunkworks.


- Added dashboard Project Mix cards for NPD, Continuous Improvement, and Skunkworks.
- Each card shows total projects and the approved/active subset.
- Preserved legacy DPT category storage while displaying it as Skunkworks.


## v7.1.0 — Development Support module

- Added a Development menu for bugs, enhancements, tasks, and support work.
- Added CSV import/export using the GitHub iteration report column format.
- Added release, area, type, status, and priority filters.
- Added a Supabase-backed side editor and development KPI summary.
- Run `supabase/v7.1.0-development.sql` before using the module.


## v7.1.4 — Development category alignment

- Renamed Development `Combined Type` to **Category** throughout the interface.
- Development dashboard Bug and Enhancement counts now use the Category field.
- Removed the separate Issue Type field and table column from Development.
- Removed Sustained — Bugs and Defects from the Product Initiatives category selector; software defects and enhancements now belong in Development.
- CSV import continues to accept the legacy `Type` column for compatibility, while CSV export uses Category only.
