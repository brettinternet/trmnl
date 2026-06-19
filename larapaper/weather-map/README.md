# Weather Map for LaraPaper

Import this directory as a LaraPaper recipe plugin archive.

## Files

- `src/settings.yaml` declares configurable map image fields.
- `src/full.liquid` renders the TRMNL-compatible view.

## Configuration

Set these fields after import:

- `image_url`: public direct image URL for the map.
- `label`: short label shown on the map.

## Weather Underground URLs

Open https://www.wunderground.com/radar/us, choose a region, then use `Image Link` and copy the direct image URL. It should look like:

```text
https://s.w-x.co/staticmaps/wu/wu/wxtype1200_cur/uspvu/current.png
```

Use the copied URL as `image_url`.
