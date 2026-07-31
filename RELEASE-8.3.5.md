# Engineering Portfolio Manager v8.3.5

## Supabase refresh reliability

- Reloads Product Initiatives and Resources from Supabase on initial page load.
- Reloads Development Support from Supabase on initial page load.
- Refreshes all shared data whenever a navigation page is opened.
- Refreshes when the browser window regains focus, the tab becomes visible, or the page is restored from browser cache.
- Re-renders Initiative Roadmap and Development Roadmap after Supabase data is loaded.
- Replaces the misleading initial Local storage badge with Loading Supabase.
- No database migration is required.
