# dollar-today

A lightweight Bun service that polls Venezuelan Bolivar (VES) to USD exchange rates from multiple sources, stores them in Redis, and exposes them as a JSON API.
It uses `Bun.serve` and Bun's native `RedisClient`, with no npm dependencies.
The HTML page uses plain CSS with no browser JavaScript. Google Fonts provides
the optional typefaces, with local sans-serif fallbacks if it is unavailable.

## Sources

- **BCV (Banco Central de Venezuela)** — Official rate via [dolarflow.com](https://dolarflow.com/api/oficial/)
- **Binance P2P** — Median VES/USDT buy price from merchant ads

## How it works

- Rates are polled every **6 hours** and stored in Redis with a **30-day TTL**
- On startup, rates are fetched immediately
- Each rate carries its own `-fetched-at` timestamp, recording the last time its
  source actually answered — independent of the top-level `date`
- If a source fails, the last cached value is served but flagged `-stale: true`.
  After `MAX_STALE_DAYS` without a successful fetch the rate is dropped from the
  response entirely rather than served indefinitely
- `GET /` — Human-readable HTML page with the latest rates
- `GET /json` — JSON API endpoint

## API

### `GET /`

Returns a styled HTML page displaying the current exchange rates.

### `GET /json`

```json
{
  "date": "2026-03-30",
  "bcv-rate": 473.87,
  "bcv-rate-fetched-at": "2026-03-30T12:00:04.512Z",
  "binance-p2p-rate": 659.63,
  "binance-p2p-rate-fetched-at": "2026-03-30T12:00:04.977Z"
}
```

A rate being served from cache after its source failed also carries
`"<rate>-stale": true`, and its `-fetched-at` stays pinned to the last successful
fetch.

Returns `503` if no usable rate data is available, including when both rates
are older than `MAX_STALE_DAYS`. Expiry is checked on every request, and an
unsuccessful poll clears the latest cache when neither rate can be retained.

## Running with Docker

```bash
docker compose up -d --build
```

The API will be available at `http://localhost:3051`.
This stack also starts its own Redis instance on `localhost:6380` by default so it does not share the default Redis port with other local projects.
The app uses public DNS resolvers for upstream requests while Docker still resolves
the internal `redis` service. This avoids inheriting host-only Tailscale DNS
servers that can return `SERVFAIL` inside the container.

The runtime is Bun 1.4.4. Upstream requests time out after 15 seconds so one
unresponsive source cannot indefinitely block saving the other source's rate.
The native Redis client uses the existing cache keys and 30-day expiry. Redis 8.10.3
is included in the Docker stack; external Redis instances must be version 7.2 or newer.

## Running locally

Install Bun 1.4.4 or newer, then run:

```bash
docker compose up -d redis
bun run start
```

Bun loads `.env` automatically. Use `.env.example` as a starting point; the
local Redis container listens on port 6380. To use a remote Redis instance,
configure `SSH_USER`, `SSH_HOST`, and `REDIS_PORT` in `.env`, then run
`bun run dev:tunnel` in another terminal.

No package installation is needed locally or in Docker. If npm dependencies are
added in the future, commit the generated `bun.lock` and add a frozen installation
step to the Dockerfile.

Run `bun test` to check rate validation and cache-age rules without Redis or
network access. The Docker health check begins during startup and then runs
every ten minutes.

## Environment variables

| Variable          | Default     | Description                                  |
| ----------------- | ----------- | -------------------------------------------- |
| `REDIS_HOST`      | `localhost` | Redis host                                   |
| `REDIS_PORT`      | `6380`      | Redis port                                   |
| `PORT`            | `3051`      | HTTP server port                             |
| `HOST`            | —           | Public hostname                              |
| `MAX_STALE_DAYS`  | `3`         | Days a rate may be served after its source fails |
