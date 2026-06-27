# Days Left This Year for LaraPaper

Import this directory as a LaraPaper recipe plugin archive.

A Stoic-calendar style view of the current year: one cell per day, filled for
days already passed and faint for days still ahead. Today's cell is outlined.

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
- **Grid** — 7 rows, one column per week, filled left-to-right top-to-bottom.
- **Title bar** — the year and the percentage of the year completed.

Leap years render 366 cells automatically.
