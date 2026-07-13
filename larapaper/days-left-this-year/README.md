# Days Left This Year for LaraPaper

Import this directory as a LaraPaper recipe plugin archive.

A Stoic-calendar style view of the current year: one cell per day in the
Sunday-aligned calendar span, filled for days already passed, shaded for days
still ahead, and mid-gray for today.

## Files

- `src/settings.yaml` declares the static strategy and the timezone field.
- `src/full.blade.php` renders the TRMNL-compatible Blade view. The current
  date is computed server-side with Carbon on each refresh, so no external data
  source is needed.

## Configuration

- `timezone`: PHP timezone identifier used to determine the current date
  (e.g. `America/Chicago`, `Europe/London`, `Asia/Tokyo`). An invalid value
  falls back to `UTC`.

## Display

- **Days Passed** — fully completed days before today.
- **Days Left** — remaining days, including today (`Days Passed + Days Left` =
  total days in the year).
- **Grid** — 7 rows and as many Sunday-first week columns as the year requires. The final partial week hides dates outside the current year, so a 2026 grid shows Sunday through Thursday for December 27–31.
- **Title bar** — the year and the percentage of the year completed.

The counters and grid use the full calendar year, including all 365 or 366
days. Sunday-aligned years require 53 or 54 week columns.
