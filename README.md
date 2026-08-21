# TRMNL Recipes

Small recipes for TRMNL devices, currently targeting [LaraPaper](https://github.com/usetrmnl/larapaper). See also [TRMNL's BYOS](https://docs.trmnl.com/go/diy/byos).

## Setup

```sh
task init
task check
```

Copy `example.env` to `.env` when needed.

## Recipes

| Recipe | Purpose |
| --- | --- |
| `larapaper/air-quality-history` | Show current US AQI beside a 92-day daily maximum chart. |
| `larapaper/apple-reminders-bridge` | Render Apple Reminders data from a user-supplied bridge endpoint. |
| `larapaper/calvin-and-hobbes-comic` | Render a random Calvin and Hobbes comic. |
| `larapaper/days-left-this-year` | Show passed, current, and remaining days in a year calendar. |
| `larapaper/farside-comic` | Render a random Far Side comic. |
| `larapaper/github-commit-graph` | Render GitHub contribution graph data. |
| `larapaper/home-assistant-calendar` | Render a rolling two-week Home Assistant calendar. |
| `larapaper/home-assistant-week-calendar` | Render Home Assistant events in a week or three-day time grid. |
| `larapaper/lds-quotes` | Render a random LDS quote. |
| `larapaper/rainfall-history` | Show 365 days of rainfall history and an eight-day forecast. |
| `larapaper/snowfall-history` | Show 365 days of snowfall history and an eight-day forecast. |
| `larapaper/weather-glance` | Render current temperature with an hourly or daily forecast. |
| `larapaper/weather-history` | Show 365 days of temperature history and an eight-day forecast. |
| `larapaper/weather-map` | Render a configurable public weather map image. |
| `larapaper/wikipedia-current-events` | Show current Wikipedia events. |
| `larapaper/wikipedia-featured-article` | Show today's featured Wikipedia article with image and QR code. |
| `larapaper/xkcd-comic` | Render the latest XKCD comic. |

Import a recipe directory as a LaraPaper plugin archive.

## Catalog

This repository publishes a LaraPaper-compatible catalog for the recipes above.

```text
https://raw.githubusercontent.com/brettinternet/trmnl/refs/heads/main/catalog.yaml
```

Set that URL as LaraPaper's `CATALOG_URL`. Validate and build the disposable recipe archives locally with:

```sh
task catalog:check
task catalog:build
```

The source recipes keep `src/settings.yaml`; published archives convert that file to the `settings.yml` extension expected by LaraPaper. Archives are uploaded to the moving `catalog-artifacts` GitHub release.

LaraPaper caches the parsed catalog for up to 12 hours. After changing `CATALOG_URL` or catalog metadata, clear Laravel's configuration and application caches:

```sh
php artisan config:clear
php artisan cache:clear
```
