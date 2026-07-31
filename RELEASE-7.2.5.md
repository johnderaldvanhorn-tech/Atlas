# Release 8.0.0

- Fixed resource migration and persistence when PostgREST returns no single-row representation.
- Resources now receive UUIDs before write and are upserted by ID.
- Removed `.single()` from resource writes to prevent PGRST116.
- Resource migration failures no longer mark the full Supabase connection as unavailable.
