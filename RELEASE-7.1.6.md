# Engineering Portfolio Manager v7.1.6

- Adds Development Department with Cloud and Edge values.
- Uses Source Line + Department as the Development record identity.
- CSV imports update an existing matching Source Line/Department pair or add a new pair.
- Adds Department to the Development table, filters, editor, CSV import, and CSV export.
- Includes a Supabase migration that defaults existing records to Cloud, removes composite duplicates, and creates a unique constraint on (source_line, department).
