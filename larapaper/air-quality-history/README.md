# Air Quality History for LaraPaper

Import this directory as a LaraPaper recipe plugin archive.

Shows the current US AQI beside a minimal daily-maximum AQI chart. The chart uses the documented Air Quality API polling span (`past_days=92`, 92 past local days) and the seven-day forecast (`forecast_days=7`). The current local date begins the shaded, dashed forecast segment; the line before it is historical model output.

## Files

- `src/settings.yaml` declares one Open-Meteo Air Quality API GET and configurable coordinates.
- `src/full.liquid` reduces the hourly US AQI response to daily maxima and renders the TRMNL-compatible Liquid view.

## Configuration

- `latitude` and `longitude`: coordinates accepted by Open-Meteo. Defaults are `33.03`, `-84.94`.

Use the [Open-Meteo Geocoding API](https://open-meteo.com/en/docs/geocoding-api) to resolve a place name to coordinates. LaraPaper polling accepts one URL, so the recipe requests `current=us_aqi` and `hourly=us_aqi` directly from the [Open-Meteo Air Quality API](https://open-meteo.com/en/docs/air-quality-api), with automatic local time.

The plugin refreshes every three hours. AQI is model-derived (not a station observation); historical daily values are the maximum valid hourly US AQI for each local calendar day.

## Data shown

- Current US AQI and its EPA category, or `Unavailable` when the current value is missing.
- Historical daily maximum US AQI and a seven-day forecast daily maximum line.
- Three spaced labels for the worst historical daily maximum in each third of the chart, showing AQI and month/day.
- Two lower reference labels mark the lowest daily maximum in each half of the historical chart; hollow markers distinguish these valleys from the filled high markers.

The documented Air Quality API range for this recipe is `past_days=92` and `forecast_days=7`. A default request contains 92 past local days and a seven-day forecast beginning on the current local date (2,376 hourly samples at the default coordinates); this is a rolling model-derived span, not a station-observation record.

Only dates with at least one valid hourly AQI are plotted; missing model values remain blank rather than becoming zero.
