# Wikipedia Current Events for LaraPaper

Import this directory as a LaraPaper recipe plugin archive.

## Files

- `src/settings.yaml` polls Wikipedia's daily Current events subpage.
- `src/full.blade.php` extracts leaf event bullets and renders a bounded full-screen view.

## Configuration

The recipe polls the Wikimedia Action API for today's UTC subpage. LaraPaper expands the date expression when it makes each request:

```text
https://en.wikipedia.org/w/api.php?action=parse&page=Portal%3ACurrent%20events%2F{{ "now" | date: "%Y" }}%20{{ "now" | date: "%B" }}%20{{ "now" | date: "%-d" }}&prop=wikitext&format=json&formatversion=2
```

The refresh interval is 900 seconds (15 minutes), which keeps the display current while avoiding a request on every device check-in.

The template extracts leaf event bullets from the returned wikitext, converts wiki links and markup to escaped plain text, and displays the current-day event descriptions in a clean grid. It reduces the text size as the feed grows so descriptions remain visible without a clipped scrolling container or an arbitrary event cap. If the API is unavailable or has no usable bullets, the view shows an explicit unavailable state.
