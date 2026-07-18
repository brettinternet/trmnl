# Weather History for LaraPaper

Import this directory as a LaraPaper recipe plugin archive.

Shows today’s high and low beside a minimal temperature chart spanning the previous 365 days and the next seven forecast days. The chart keeps a strong daily-mean line, lighter daily high/low lines, four spaced seasonal peak labels, two lower seasonal valley labels, and a shaded forecast period.

## Files

- `src/settings.yaml` declares the Open-Meteo Historical Forecast API request and configurable fields.
- `src/full.liquid` renders the TRMNL-compatible Liquid view.

## Configuration

- `latitude` and `longitude`: coordinates accepted by Open-Meteo. Defaults are `33.03`, `-84.94`.
- `temp_unit`: `fahrenheit` or `celsius`.

Use the [Open-Meteo Geocoding API](https://open-meteo.com/en/docs/geocoding-api) to resolve a place name to coordinates. LaraPaper polling accepts one URL, so this recipe uses Open-Meteo's Historical Forecast endpoint with `models=gfs_seamless` to return the local date, reconstructed forecast-model history, and the seven-day outlook in one response. Pinning GFS Seamless instead of Open-Meteo's Best Match trades location-specific model selection for a consistent global model, removes selection variability from the long request, and reduces cold-request work.

The plugin refreshes daily. Pinning one global model keeps the request shape predictable while retaining the full chart span.

## Data shown

- Today’s high and low temperatures
- Daily mean, maximum, and minimum temperatures for the previous 365 days
- Projected maximum and minimum temperatures for the next seven days
- Peak and valley labels with short month names and dates

The historical series is GFS Seamless model-based historical forecast data, not a station observation record.
