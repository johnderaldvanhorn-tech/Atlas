# Engineering Portfolio Manager v8.3.3

## Development Roadmap visible-range filtering

- Development Support items are rendered only when their schedule overlaps the selected fiscal or calendar year range.
- The 1-, 2-, and 3-year selectors expand the visible range and include overlapping work accordingly.
- Items that begin before the range or finish after it remain visible when they overlap the selected period.
- Added a **Show Unscheduled** toggle, off by default.
- Unscheduled Development Support items are hidden unless the toggle is enabled.
- Initiative Roadmap continues to use the same overlap-based range behavior.
- No Supabase migration is required.
