# Home Assistant Calendar for LaraPaper

Import this directory as a LaraPaper recipe plugin archive.

Renders a rolling two-week calendar from a Home Assistant calendar entity, with
event dots per day and an upcoming-appointments list.

## Files

- `src/settings.yaml` declares the polling request and configurable fields.
- `src/full.blade.php` renders the TRMNL-compatible Blade view.

## Configuration

Set these fields after import:

- `api_token`: Home Assistant long-lived access token.
- `home_assistant_domain`: domain of your instance (e.g. `ha.example.com`).
- `calendar_entity_id`: calendar entity ID without the `calendar.` prefix
  (e.g. `my_calendar`).

The plugin polls `https://{domain}/api/calendars/calendar.{entity_id}` for a
14-day window starting today. The display timezone is set in
`src/full.blade.php` (`$tz`, default `America/Chicago`).
