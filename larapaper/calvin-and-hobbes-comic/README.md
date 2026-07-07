# Calvin and Hobbes Comic for LaraPaper

Import this directory as a LaraPaper recipe plugin archive.

Renders a random comic from the unofficial ComicCaster Calvin and Hobbes RSS feed, including the proxied GoComics image.

## Files

- `src/settings.yaml` declares the direct RSS polling request.
- `src/full.blade.php` renders the TRMNL-compatible Blade view and chooses a random feed item on each render.

## Configuration

No configuration is required. The plugin polls the direct RSS feed every 6 hours:

```text
https://comiccaster.xyz/rss/calvinandhobbes
```

Each render randomly picks one item from the polled feed, so reloads can show different comics without using the xml-to-js proxy or changing the polling configuration.
