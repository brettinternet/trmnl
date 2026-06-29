# XKCD Comic for LaraPaper

Import this directory as a LaraPaper recipe plugin archive.

## Files

- `src/settings.yaml` polls the XKCD JSON API.
- `src/full.blade.php` renders the comic image, title, number, date, and alt text.

## Configuration

Set `mode` to one of:

- `latest`: render the newest comic from `https://xkcd.com/info.0.json`.
- `random`: render a deterministic random comic URL per refresh using XKCD's numbered `info.0.json` endpoints.

`latest_comic_number` is only used by random mode as the upper bound. The default is `3265`, current as of 2026-06-29. Update it occasionally so random mode can include newer comics.

Comic number 404 is skipped because XKCD does not publish a JSON endpoint for that number.
