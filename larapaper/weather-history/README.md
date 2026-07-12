# Weather History for LaraPaper

Import this directory as a LaraPaper recipe plugin archive.

Shows today’s high and low beside a minimal temperature chart spanning the previous 365 days and the next seven forecast days. The chart keeps a strong daily-mean line, lighter daily high/low lines, four spaced seasonal peak labels, two lower seasonal valley labels, and a shaded forecast period.

## Files

- `src/settings.yaml` declares the Open-Meteo Historical Forecast API request and configurable fields.
- `src/full.liquid` renders the TRMNL-compatible Liquid view.

## Configuration

- `latitude` and `longitude`: coordinates accepted by Open-Meteo. Defaults are `33.03`, `-84.94`.
- `temp_unit`: `fahrenheit` or `celsius`.

Use the [Open-Meteo Geocoding API](https://open-meteo.com/en/docs/geocoding-api) to resolve a place name to coordinates. LaraPaper polling accepts one URL, so the recipe uses Open-Meteo's Historical Forecast endpoint: it returns the local date, reconstructed forecast-model history, and the seven-day outlook in one response.

The plugin refreshes daily. A year-long response can take longer than a normal forecast request.

## Data shown

- Today’s high and low temperatures
- Daily mean, maximum, and minimum temperatures for the previous 365 days
- Projected maximum and minimum temperatures for the next seven days
- Peak and valley labels with short month names and dates

The historical series is model-based historical forecast data, not a station observation record.
