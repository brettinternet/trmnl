# LDS Quotes for LaraPaper

Import this directory as a LaraPaper recipe plugin archive.

Renders a random quote from `gospel-quotes.netlify.app`, sized to use more of the TRMNL display for shorter quotes while preserving long quotes.

## Files

- `src/settings.yaml` polls the random quote JSON endpoint.
- `src/full.liquid` renders the quote, author, category, and optional title bar.

## Configuration

Optional fields after import:

- `show_title_bar`: `yes` shows the bottom title bar; `no` hides it and lets the quote use that space.

The plugin polls this endpoint hourly:

```text
https://gospel-quotes.netlify.app/random?max-length=1500
```
