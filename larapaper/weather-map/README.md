# Weather Map for LaraPaper

Import this directory as a LaraPaper recipe plugin archive.

## Files

- `src/settings.yaml` declares configurable map image fields.
- `src/full.liquid` renders the TRMNL-compatible view.

## Configuration

Set these fields after import:

- `image_url`: public direct image URL for the map.
- `image_scale`: CSS scale value for cropping legends or borders. Use `1` on memory-limited devices.
- `image_position`: CSS position/origin for the crop.
- `image_filter`: CSS filter applied before LaraPaper snapshots the rendered screen.
- `image_rendering`: CSS `image-rendering` mode. `pixelated` avoids interpolation gradients.

The template reads these from LaraPaper custom fields. No data payload is required.

## E1003 / small image limit

Some BYOD firmware builds reject compressed image downloads above `90000` bytes. The E1003 log line `file size too big: 117761` is this limit. Other BYOD device types may work because they render at a lower resolution or use firmware with a larger download limit.

To reduce the generated PNG size:

1. Keep `image_scale=1`. CSS scaling resamples the map and creates many intermediate gray pixels.
2. Keep `image_rendering=pixelated`.
3. Use a darker, high-contrast `image_filter` to crush gradients without washing out the map:

```text
grayscale(1) contrast(2.8) brightness(0.85)
```
   
   If it is still too light, lower brightness toward `0.75`. If it gets muddy, raise brightness toward `0.95`.

4. Prefer a regional or lower-detail `image_url` over a full CONUS map.

The default is the National Weather Service CONUS radar image:

```text
https://radar.weather.gov/ridge/standard/CONUS_0.gif
```

## Weather Underground URLs

Open https://www.wunderground.com/radar/us, choose a region, then use `Image Link` and copy the direct image URL. It should look like:

```text
https://s.w-x.co/staticmaps/wu/wu/wxtype1200_cur/conus/current.png
```

Use the copied URL as `image_url`.

For Weather Underground regional maps, `image_scale=1.12` and `image_position=center top` usually hides the bottom legend, but use `image_scale=1` first on E1003-class devices to stay under the firmware download limit.
