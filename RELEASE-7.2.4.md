# Release 7.2.4

- Corrected resource synchronization when a locally cached resource ID does not exist in Supabase.
- Local or non-UUID resource IDs are inserted as new Supabase rows.
- UUID updates that return zero rows automatically fall back to insert.
- Returned Supabase UUIDs replace local identifiers after synchronization.
