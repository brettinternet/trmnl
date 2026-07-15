# TRMNL Recipes

Small recipes for TRMNL devices, currently targeting [LaraPaper](https://github.com/usetrmnl/larapaper). See also [TRMNL's BYOS](https://docs.trmnl.com/go/diy/byos).

## Setup

```sh
task init
task check
```

Copy `example.env` to `.env` when needed.

## Recipes

| Recipe                          | Purpose                                                |
| ------------------------------- | ------------------------------------------------------ |
| `larapaper/weather-map`         | Render any public map image URL.                       |
| `larapaper/xkcd-comic`          | Render the latest XKCD comic.                          |
| `larapaper/farside-comic`       | Render one comic from the Far Side daily RSS feed.     |
| `larapaper/lds-quotes`          | Render a random quote from Gospel Quotes.              |
| `larapaper/github-commit-graph` | Render GitHub contribution data from GraphQL.          |
| `larapaper/days-left-this-year` | Stoic-calendar grid of days passed and left this year. |

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
