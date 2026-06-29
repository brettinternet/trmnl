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
| `larapaper/xkcd-comic`          | Render the latest or a random XKCD comic.              |
| `larapaper/farside-comic`       | Render one comic from the Far Side daily RSS feed.     |
| `larapaper/github-commit-graph` | Render GitHub contribution data from GraphQL.          |
| `larapaper/days-left-this-year` | Stoic-calendar grid of days passed and left this year. |

Import a recipe directory as a LaraPaper plugin archive.
