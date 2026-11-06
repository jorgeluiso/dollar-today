# Agent notes

## The JSON API is a contract

Other projects depend on `GET /json`, and pushing to `main` deploys to production
automatically, so a breaking change reaches consumers as soon as it lands. Treat
every API change as a compatibility decision.

**Breaking, so do not ship without telling the user first:**

- Renaming or removing a field, including `-fetched-at` and `-stale`
- Changing a field's type, unit, or meaning
- Changing when `/json` answers `200` or `503`, or moving the route
- Making an optional field required for a successful response

**Safe:** adding a new field. Consumers must keep working without it, so a new rate
must not count toward the `503` check (see `hasRates` in `src/cache.js`).

**To make a breaking change:** say so explicitly, name the consumers affected, then
publish the new shape alongside the old one, migrate the consumers, and only then
remove the old shape.

## Consumers

**Porter** (`~/code/porter`) reads this API through `VES_EXCHANGE_RATE_URL`:

| File | Reads | If it is missing or invalid |
| --- | --- | --- |
| `src/mcp/exchange-rate-service.ts` | `date`, plus `bcv-rate` and `binance-p2p-rate` with their `-fetched-at` and `-stale` | Either rate missing fails the `get_exchange_rates` MCP tool |
| `src/console/api.ts` | `binance-p2p-rate`, `bcv-rate`, `date` | Falls back or reports a failed health check |
| `src/ai/tools/index.ts` | `binance-p2p-rate` | Falls back to a default rate |

Search for these field names in any new consumer's repository before changing them,
and add new consumers to this table.

## The page stays minimal

`GET /` is for people thinking through the numbers: three rates with labels, and a
tiny toggle. It uses no browser JavaScript, so interaction is CSS over server-rendered
values. Helper math like the discount belongs here, not in the API.
