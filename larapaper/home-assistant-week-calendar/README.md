# Home Assistant Week Calendar for LaraPaper

Import this directory as a LaraPaper recipe plugin archive.

Renders Home Assistant calendar events in a traditional time-grid calendar. All-day
events appear above the grid, and timed events appear between hour markers. The grid
normally shows 7:00 AM through 9:00 PM, expanding only when an event falls outside
that window.

## Files

- `src/settings.yaml` declares the polling request and configurable fields.
- `src/full.blade.php` renders the TRMNL-compatible Blade view.

## Configuration

Set these fields after import:

- `api_token`: Home Assistant long-lived access token.
- `home_assistant_domain`: domain of your instance (e.g. `ha.example.com`).
- `calendar_entity_id`: calendar entity ID without the `calendar.` prefix
  (e.g. `my_calendar`).
- `calendar_view`: show the current Sunday-through-Saturday week or today and the
  next two days.
- `timezone`: IANA timezone used to place events in the grid (e.g.
  `America/Denver`).

The plugin polls a window wide enough to cover either display mode. Date-only and
midnight-to-midnight events are treated as all-day events.
