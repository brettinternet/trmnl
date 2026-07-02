# Weather Glance for LaraPaper

Import this directory as a LaraPaper recipe plugin archive.

Renders the current temperature and an hourly or daily Open-Meteo forecast directly in the recipe template.

## Files

- `src/settings.yaml` declares the Open-Meteo polling request and configurable fields.
- `src/full.liquid` renders the TRMNL-compatible Liquid view.

## Configuration

Set these fields after import:

- `latitude`: location latitude. Defaults to `33.03` when blank.
- `longitude`: location longitude. Defaults to `-84.94` when blank.
- `temp_unit`: `fahrenheit` or `celsius`.
- `forecast_interval`: `daily`, `1`, `2`, or `3` for daily, hourly, every two hours, or every three hours.
- `time_format`, `hourly_time_format`, `date_format`: optional `strftime` display formats.
- `pill_count_override`: `automatic` or a fixed bar count from 3 through 7.
- `hide_title_bar`: hide the TRMNL title bar when set to `yes`.
- `location_name`: optional title bar instance label.

The plugin polls Open-Meteo every 60 minutes with timezone detection enabled.
