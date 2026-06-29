# Far Side Comic for LaraPaper

Import this directory as a LaraPaper recipe plugin archive.

Renders one comic from the unofficial ComicCaster Far Side daily RSS feed, including the proxied comic image and optional caption.

## Files

- `src/settings.yaml` declares the RSS polling request and configurable fields.
- `src/full.liquid` renders the TRMNL-compatible Liquid view.

## Configuration

Optional fields after import:

- `comic_position`: 1 selects the newest RSS item; higher numbers select older items still present in the feed.
- `show_caption`: `yes` shows the caption below the comic; `no` hides it.

The plugin polls `https://comiccaster.xyz/feeds/farside-daily.xml` every 6 hours.
