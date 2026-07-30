# dollar-today

A lightweight Node.js service that polls Venezuelan Bolivar (VES) to USD exchange rates from multiple sources, stores them in Redis, and exposes them as a JSON API.

## Sources

- **BCV (Banco Central de Venezuela)** — Official rate via [dolarflow.com](https://dolarflow.com/api/oficial/)
- **Binance P2P** — Average VES/USDT buy price from merchant ads

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

Returns `503` if no rate data has been fetched yet.

## Running with Docker

```bash
docker compose up -d
```

The API will be available at `http://localhost:3051`.
This stack also starts its own Redis instance on `localhost:6380` by default so it does not share the default Redis port with other local projects.

## Environment variables

| Variable          | Default     | Description                                  |
| ----------------- | ----------- | -------------------------------------------- |
| `REDIS_HOST`      | `localhost` | Redis host                                   |
| `REDIS_PORT`      | `6380`      | Redis port                                   |
| `PORT`            | `3051`      | HTTP server port                             |
| `HOST`            | —           | Public hostname                              |
| `MAX_STALE_DAYS`  | `3`         | Days a rate may be served after its source fails |
