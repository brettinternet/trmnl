# Snowfall History for LaraPaper

Import this directory as a LaraPaper recipe plugin archive.

Shows a year of daily snowfall as a quiet e-ink chart: the previous 365 days are drawn as a dark line, while today and the next seven strictly future days sit in a shaded, dashed forecast zone. The large value is the accumulated snowfall over the previous 365 days; the smaller value counts snowy days with at least 1 cm (0.4 in), and the first and last snowy dates label the season's span.

## Files

- `src/settings.yaml` declares one Open-Meteo Historical Forecast API polling request and the configurable coordinates and snowfall unit.
- `src/full.liquid` renders the TRMNL-compatible Liquid view.

## Configuration

- `latitude` and `longitude`: coordinates accepted by Open-Meteo. Defaults are `33.03`, `-84.94`.
- `snowfall_unit`: `inch` or `cm`.

Use the [Open-Meteo Geocoding API](https://open-meteo.com/en/docs/geocoding-api) to resolve a place name to coordinates. LaraPaper polling accepts one URL, so this recipe uses Open-Meteo's Historical Forecast endpoint with `models=gfs_seamless`, `past_days=365`, `forecast_days=8`, and only `daily=snowfall_sum`. Pinning GFS Seamless instead of Open-Meteo's Best Match trades location-specific model selection for a consistent global model, removes selection variability from the long request, and reduces cold-request work.

Each response contains exactly 365 prior daily dates, today, and seven strictly future daily dates (373 dates total). The historical values are reconstructed GFS Seamless forecast-model data, not station observations; the seven future values are the GFS Seamless forecast.

The plugin refreshes every four hours, using a separate cadence to reduce synchronization opportunities with the rainfall recipe's three-hour polling. Pinning one global model keeps the request shape predictable while retaining the full chart span.
