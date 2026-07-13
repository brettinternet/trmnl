# Days Left This Year for LaraPaper

Import this directory as a LaraPaper recipe plugin archive.

A Stoic-calendar style view of the current year: one cell per day in the
fixed 52-week Sunday-aligned window, filled for days already passed, shaded
for days still ahead, and mid-gray for today.

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
- **Grid** — 7 rows and 52 columns, with Sunday as the first square in each week. The fixed 52-week display has 364 day slots; year-end dates beyond that fixed window are not rendered.
- **Title bar** — the year and the percentage of the year completed.

The counters use the full calendar year, including all 366 days in leap years;
the grid remains a fixed 52 weeks.
