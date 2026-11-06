const CORE_RATE_KEYS = ["bcv-rate", "binance-p2p-rate"];
const RATE_KEYS = [...CORE_RATE_KEYS, "bcv-euro-rate"];

// API contract: /json answers 503 when neither core rate is usable. The euro rate
// is an optional extra, so it alone must not turn that into a 200 for consumers.
function hasRates(entry) {
  return CORE_RATE_KEYS.some((key) => Number.isFinite(entry[key]) && entry[key] > 0);
}

// The Redis TTL preserves history for 30 days; it is not permission to serve
// an old rate. Enforce the source age on every read, even between polls.
function pruneExpiredRates(entry, maxAgeMs, now = Date.now()) {
  const available = { ...entry };
  for (const key of RATE_KEYS) {
    const age = now - Date.parse(available[`${key}-fetched-at`]);
    if (
      !Number.isFinite(available[key]) || available[key] <= 0 ||
      !Number.isFinite(age) || age < 0 || age > maxAgeMs
    ) {
      delete available[key];
      delete available[`${key}-fetched-at`];
      delete available[`${key}-stale`];
    }
  }
  return available;
}

module.exports = { hasRates, pruneExpiredRates };
