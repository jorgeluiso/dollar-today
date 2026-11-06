# dollar-today

A lightweight Bun service that polls Venezuelan Bolivar (VES) exchange rates from multiple sources, stores them in Redis, and exposes them as a JSON API.
It uses `Bun.serve` and Bun's native `RedisClient`, with no npm dependencies.
The HTML page uses plain CSS with no browser JavaScript. Google Fonts provides
the optional typefaces, with local sans-serif fallbacks if it is unavailable.

Other projects depend on the JSON API. See [API stability](#api-stability) before
changing it.

## Sources

- **BCV (Banco Central de Venezuela)** — Official VES per USD
- **Tasa Euro** — BCV's official VES per EUR. People quote a USD price at this rate
  to offset the gap between the official and market dollar rates.
- **Binance P2P** — Median VES/USDT buy price from merchant ads

Both official rates cascade, using the first source that answers with a usable
number:

| Rate | 1. Source of truth | 2. Fallback | 3. Fallback |
| --- | --- | --- | --- |
| BCV | [bcv.org.ve](https://www.bcv.org.ve/) | [dolarapi](https://ve.dolarapi.com/v1/dolares/oficial) | [dolarflow](https://dolarflow.com/api/oficial/) |
| Tasa Euro | [bcv.org.ve](https://www.bcv.org.ve/) | [dolarapi](https://ve.dolarapi.com/v1/euros/oficial) | — |

Falling back to another source is logged. Rates are published as sources report
them, with no check on how far they sit from each other, because the point is to
show what is happening. dolarflow is not a euro fallback because its euro endpoint
misreads BCV's `1.004,95` as `1.004`.

BCV's server sends the wrong intermediate certificate, which default TLS clients
reject. BCV is the authority for these rates, so its request skips certificate
verification as a deliberate choice, accepting that someone on the network path
could alter the response. Every other source verifies normally.

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

The small **Discount** toggle shows how far each rate sits from an anchor rate:
`rate / anchor - 1`. A negative number is the discount someone gives by accepting
that rate if the anchor is the true value. Binance P2P is the default anchor, and
tapping any rate makes it the anchor. Choices reset when the page reloads. This
math is a thinking aid for people, so it stays in the page and out of the API.

### `GET /json`

```json
{
  "date": "2026-03-30",
  "bcv-rate": 473.87,
  "bcv-rate-fetched-at": "2026-03-30T12:00:04.512Z",
  "binance-p2p-rate": 659.63,
  "binance-p2p-rate-fetched-at": "2026-03-30T12:00:04.977Z",
  "bcv-euro-rate": 531.42,
  "bcv-euro-rate-fetched-at": "2026-03-30T12:00:05.102Z"
}
```

`bcv-rate` and `binance-p2p-rate` are VES per USD (USDT for Binance).
`bcv-euro-rate` is VES per EUR, and is omitted when it has no usable value.

A rate being served from cache after its source failed also carries
`"<rate>-stale": true`, and its `-fetched-at` stays pinned to the last successful
fetch.

Returns `503` if neither `bcv-rate` nor `binance-p2p-rate` is usable, including
when both are older than `MAX_STALE_DAYS`, even if `bcv-euro-rate` is available.
Expiry is checked on every request, and an unsuccessful poll clears the latest
cache when neither can be retained.

### API stability

`/json` is a contract with other projects. Do not rename or remove its fields, or
change their types, units, or status codes, without updating every consumer first.
Adding a new field is safe. [AGENTS.md](AGENTS.md) has the rules and the consumers.

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
