# Release 7.1.4 — Development source identity

- Treats `source_line` as the unique identifier for Development work items.
- CSV imports update an existing row when the same source is imported again.
- Duplicate source rows inside a single CSV are collapsed before upload.
- Requires Source Line for manual Development records.
- Wraps long Development titles and reduces the table minimum width.
- Includes a Supabase migration that removes existing duplicates and creates a unique partial index on `source_line`.
