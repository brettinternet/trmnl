# Home Assistant Bridge — Design

Goal: show a Larapaper-rendered screen in Home Assistant as if it were a real TRMNL device, via a `generic` camera entity.

## Why HA can't hit Larapaper directly

- Device auth is header-based (`ID: <mac>`, `Access-Token: <api_key>`). HA's `generic` camera only supports basic/digest auth baked into the still-image URL — no arbitrary headers.
- `/api/display` and `/api/setup` return JSON (`image_url`, `refresh_rate`, `special_function`, ...), not image bytes. `generic` camera needs a URL that returns image bytes.
- `image_url` in the response is built from Larapaper's `APP_URL` / public storage disk — may not resolve from HA's network/container as-is.
- Device model determines MIME: OG/mono models return `image/bmp`. HA's `generic` config flow only accepts png/jpeg/gif/svg+xml/webp for the still-image URL — bmp must be converted.
- `/api/display` runs telemetry update + playlist-advance (`RunDeviceDisplayCycle`) on every call. Polling it at HA card-refresh cadence (seconds) would fast-forward the playlist and spam telemetry, unlike a real device that calls it once per `refresh_rate`.
- No stock HA mechanism unwraps headers + JSON + format conversion: `command_line` has no camera platform, `generic` camera can't do headers or JSON.

Conclusion: a small bridge service is required. HA-side stays stock (`generic` camera), no custom component.

## Architecture

```mermaid
flowchart LR
  subgraph Larapaper
    D[Device: fake TRMNL\nmac + api_key]
  end
  subgraph Bridge (bun service)
    P[Poll loop] -->|GET /api/display\nID + Access-Token| Larapaper
    P -->|refresh_rate seconds| P
    P --> C[Cache: bytes + mtime + mime]
    C --> H[HTTP: GET /image, GET /health]
  end
  subgraph HomeAssistant
    G[generic camera\nstill_image_url] --> H
  end
```

### Larapaper side

- Fake device auto-provisions on bridge first run: bridge generates a synthetic MAC, calls `/api/setup` with `ID: <mac>` (no `Access-Token` yet). `ResolveDeviceByMacAddress`/auto-assign path creates the device (requires a user with `assign_new_devices` enabled) and returns `api_key` + `friendly_id`.
- Bridge persists `{mac, api_key, friendly_id}` to a local state file so restarts don't reprovision.
- Assign the device a playlist/model in the Larapaper admin UI as normal (mono vs. e1002/color) — this controls what the bridge polls.

### Bridge service (bun)

Single long-running process, one poll loop per configured device:

1. `GET /api/display` with `ID`/`Access-Token` headers → `{image_url, refresh_rate, filename, special_function}`.
2. If `LARAPAPER_IMAGE_BASE_URL` is set, rewrite `image_url`'s scheme+host to it (explicit opt-in only — don't blindly rewrite every host, since public/S3-backed storage disks may legitimately point external).
3. Fetch image bytes. If content-type is `image/bmp`, convert to PNG via ImageMagick (`magick`/`convert`, already an `mise` dep — check for the binary at bridge startup and fail fast with a clear error if BMP conversion is needed but the binary is missing, rather than serving bmp/garbage to HA's config-flow validator).
4. Store bytes + mime + timestamp in memory (and optionally on disk for restart resilience).
5. Reschedule next poll using the server's own `refresh_rate`, clamped to a floor (e.g. 60s) to avoid hammering Larapaper if it ever returns something tiny. This is what keeps playlist advance / telemetry writes at real-device cadence, independent of how often HA re-requests `/image`.
6. On poll failure: log, keep serving last-good cached image (subject to the staleness cutoff above), and back off with bounded exponential retry (e.g. 5s, 10s, 20s... capped at `refresh_rate`) rather than a fixed interval — avoids hammering a down Larapaper while still recovering fast once it's back.

HTTP surface:

- `GET /image` → last-good cached bytes with correct `Content-Type` once the cache is warm. Before the first successful poll, or if the cache has gone stale past some max-age, returns `503` rather than fabricating an image — a card showing "unavailable" is more honest than a stale-forever picture, and this matches `generic` camera's own handling of fetch failures.
- `GET /health` → JSON: last success time, last error (if any), current mime, next-poll ETA. For operator visibility, not consumed by HA.

**Startup ordering matters**: attempt the first poll before the HTTP server starts accepting `/image`, but bound that wait (e.g. 10s timeout) — if Larapaper is slow/down at bridge startup, start the server anyway with `/image` and `/health` reporting unavailable/`503`, and let the poll loop's retry/backoff bring it up once reachable. HA's `generic` camera config flow does a one-time fetch of the still-image URL during setup; document that setup should be run once `/health` reports healthy, not immediately after starting the bridge.

### Home Assistant side

Plain `generic` camera integration (config-flow, no YAML component needed):

- Still Image URL: `http://<bridge-host>:<port>/image`
- Bind the bridge to a trusted interface (LAN/VPN, not `0.0.0.0` on an untrusted network). If it must be reachable beyond that, set `LARAPAPER_BRIDGE_BASIC_AUTH_USER`/`LARAPAPER_BRIDGE_BASIC_AUTH_PASS` on the bridge and fill in HA's Username/Password fields — there's no per-request header support otherwise, so basic auth is the only credential path `generic` camera can drive.

Drop the resulting camera entity into a Picture Entity / Picture Glance card.

## Config surface (bridge)

Env vars, following this repo's `.env` convention:

- `LARAPAPER_BASE_URL` (reuse existing)
- `LARAPAPER_BRIDGE_DEVICE_MAC` — synthetic MAC to provision, generated once and persisted if unset
- `LARAPAPER_BRIDGE_STATE_FILE` — where `{mac, api_key, friendly_id}` persists (default `.task/larapaper-bridge-state.json` — `.task` is already gitignored, no new ignore rule needed)
- `LARAPAPER_BRIDGE_PORT` — HTTP listen port
- `LARAPAPER_BRIDGE_MIN_POLL_SECONDS` — floor for `refresh_rate` (default 60)

## Risks / open items for implementation phase

- Auto-provision requires a Larapaper user with `assign_new_devices` enabled; document this as a one-time manual toggle in Larapaper's admin UI.
- ImageMagick must be present in whatever runtime hosts the bridge (not just the dev machine's `mise` PATH) — check explicitly at startup, not lazily on first BMP.
- If Larapaper is only reachable via a hostname HA's network can't resolve (e.g. Tailscale-only), the bridge itself needs to run somewhere both networks can reach — likely alongside Larapaper, not alongside HA.
- Playlist semantics: this shows the *current* device screen, cycling exactly like a real device (same `refresh_rate`), not an on-demand "give me this recipe's latest render" — that's a different, simpler feature (Larapaper's per-plugin alias endpoint) if ever wanted instead.
