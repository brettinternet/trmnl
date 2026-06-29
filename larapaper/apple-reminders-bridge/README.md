# Apple Reminders Bridge for LaraPaper

Import this directory as a LaraPaper recipe plugin archive.

This recipe renders Apple Reminders data from a user-supplied bridge endpoint. It does not log in to Apple, run EventKit, or store Apple Account credentials. The bridge owns Apple access and returns normalized JSON for LaraPaper to poll.

## Files

- `src/settings.yaml` declares the bridge polling request and configurable fields.
- `src/full.blade.php` renders the TRMNL-compatible Blade view.

## Why a bridge is required

Apple Reminders does not expose a simple public HTTP API that a LaraPaper recipe can poll directly. The bridge can be any service that can read reminders and return the contract below, for example:

- a macOS service using EventKit with local Reminders permission.
- a Shortcuts automation that exports reminders to an HTTP endpoint.
- a private iCloud/CalDAV adapter for personal use, if you accept the auth/session fragility.

Do not put Apple Account passwords or iCloud session cookies in this recipe. Use a bridge-specific bearer token instead.

## Configuration

Set these fields after import:

- `bridge_url`: HTTPS endpoint that accepts the polling request, e.g. `https://reminders.example.com/api/reminders`.
- `bridge_token`: bearer token checked by the bridge.
- `reminder_view`: `today`, `scheduled`, or `list`.
- `list_name`: Apple Reminders list name, used only when `reminder_view` is `list`.
- `scheduled_days`: number of days ahead for `scheduled`.
- `timezone`: display timezone, e.g. `America/Chicago`.

## Bridge request

LaraPaper sends a POST request:

```http
POST /api/reminders
Authorization: Bearer <bridge_token>
Content-Type: application/json
Accept: application/json
```

```json
{
  "view": "today",
  "list": "Groceries",
  "days": 7,
  "timezone": "America/Chicago"
}
```

## Bridge response

Return JSON with incomplete reminders. Extra fields are ignored.

```json
{
  "generated_at": "2026-06-29T14:10:00-05:00",
  "timezone": "America/Chicago",
  "view": "today",
  "list": null,
  "reminders": [
    {
      "id": "A1B2",
      "title": "Call dentist",
      "notes": "",
      "list": "Personal",
      "due_at": "2026-06-29T09:00:00-05:00",
      "all_day": false,
      "priority": 0,
      "completed": false
    }
  ]
}
```

Field notes:

- `title` is required by the template; missing titles render as `Untitled`.
- `due_at` may be `null` for undated reminders.
- `all_day` controls date-only display.
- `priority` sorts higher-priority reminders before lower-priority reminders when due dates match.
- `completed: true` reminders are hidden.

## View semantics

`today` and `scheduled` are smart views, not Apple list names.

- `today`: incomplete reminders due today or overdue.
- `scheduled`: incomplete reminders with a due date from now through `days` days ahead.
- `list`: incomplete reminders from the exact `list_name`, including undated items.
