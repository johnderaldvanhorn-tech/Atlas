# Engineering Portfolio Manager v7.0.2

## Cloud-first projects

- Supabase is now the authoritative source for project records.
- The Mac and Raspberry Pi load the same project portfolio from Supabase.
- Project creation, editing, deletion, and CSV import write to Supabase first.
- Browser localStorage no longer stores the project list.
- Resources and formula settings remain locally cached for this sprint.
- Sales/Marketing values, including Price / Lift, load from and save to `project_sales_marketing`.

## Installation

1. Run `supabase/v7.0.2-migration.sql` in the Supabase SQL Editor.
2. Copy the release into the project directory or run `./install-7.0.2.sh`.
3. Deploy with `./release.sh 7.0.2`.
4. Hard refresh both the Mac and Pi browsers.
