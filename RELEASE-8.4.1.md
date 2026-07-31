# ATLAS v8.4.1

## Reliability fixes

- Prevents removed or inactive page elements from crashing the global renderer.
- Product Initiative selection and editor opening work even when optional dashboard sections are absent.
- Initiative Roadmap can render after Supabase refresh without being interrupted by another page renderer.
- Supabase refresh isolates page-specific rendering failures rather than cascading through the application.
- Adds safe checks for the removed Quadrant chart and current-quarter dashboard table.

No database migration is required.
