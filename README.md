# dollar-today

A lightweight Node.js service that polls Venezuelan Bolivar (VES) to USD exchange rates from multiple sources, stores them in Redis, and exposes them as a JSON API.

## Sources

- **BCV (Banco Central de Venezuela)** — Official rate via [bcv-api.rafnixg.dev](https://bcv-api.rafnixg.dev/rates/)
- **Binance P2P** — Average VES/USDT buy price from merchant ads

## How it works

- Rates are polled every **6 hours** and stored in Redis with a **30-day TTL**
- On startup, rates are fetched immediately
- `GET /` — Human-readable HTML page with the latest rates
- `GET /json` — JSON API endpoint

## API

### `GET /`

Returns a styled HTML page displaying the current exchange rates.

### `GET /json`

```json
{
  "bcv-rate": 473.87,
  "binance-p2p-rate": 659.63,
  "date": "2026-03-30"
}
```

Returns `503` if no rate data has been fetched yet.

## Running with Docker

```bash
docker compose up -d
```

The API will be available at `http://localhost:3051`.
This stack also starts its own Redis instance on `localhost:6380` by default so it does not share the default Redis port with other local projects.

## Environment variables

| Variable     | Default     | Description         |
| ------------ | ----------- | ------------------- |
| `REDIS_HOST` | `localhost` | Redis host          |
| `REDIS_PORT` | `6380`      | Redis port          |
| `PORT`       | `3051`      | HTTP server port    |
| `HOST`       | —           | Public hostname     |
