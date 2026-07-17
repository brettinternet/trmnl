# Wikipedia Today's Featured Article for LaraPaper

Import this directory as a LaraPaper recipe plugin archive.

## Files

- `src/settings.yaml` polls Wikimedia's featured feed for the current date.
- `src/full.blade.php` renders the featured article title, description, extract, image, article link, and QR code.

## Data and refresh

The recipe uses Wikimedia's public JSON feed:

```text
https://api.wikimedia.org/feed/v1/wikipedia/en/featured/YYYY/MM/DD
```

The polling URL supplies `YYYY/MM/DD` dynamically with Larapaper's `now` date expression. It refreshes once per hour (`refresh_interval: 3600`), so the article rolls over during the day without manual configuration. No API token or custom fields are required.

The template reads `tfa` from the feed and prefers `titles.display`, `description`, `extract`, `thumbnail.source`, and `content_urls.desktop.page`, with sensible fallbacks for alternate feed shapes. External text and URLs are escaped before rendering. A QR image is requested from the public QRServer endpoint only when the article has an HTTP(S) desktop or mobile page URL; the target is URL-encoded in the QR request. QR rendering is optional and does not prevent the article from displaying.

If Wikimedia returns an error, an empty response, or no featured article, the recipe shows an unavailable state. If the article has no usable thumbnail, the image panel shows a no-image fallback while title, text, link, and QR content remain available.
