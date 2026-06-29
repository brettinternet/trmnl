# XKCD Comic for LaraPaper

Import this directory as a LaraPaper recipe plugin archive.

## Files

- `src/settings.yaml` polls the XKCD JSON API.
- `src/full.blade.php` renders the comic image, title, number, date, and alt text.

## Configuration

No configuration is required. The recipe renders the latest comic from XKCD's official JSON endpoint:

```text
https://xkcd.com/info.0.json
```

XKCD's official JSON API also supports numbered comic URLs, but it does not provide a random JSON endpoint.
