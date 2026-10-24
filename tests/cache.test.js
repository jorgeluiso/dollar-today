const { describe, expect, test } = require("bun:test");
const { hasRates, pruneExpiredRates } = require("../src/cache");

const now = Date.parse("2026-10-24T12:00:00Z");
const maxAge = 3 * 24 * 60 * 60 * 1000;
const entry = {
  date: "2026-10-24",
  "bcv-rate": 887.3,
  "bcv-rate-fetched-at": new Date(now - 60_000).toISOString(),
  "binance-p2p-rate": 1005.3,
  "binance-p2p-rate-fetched-at": new Date(now - maxAge).toISOString(),
  "binance-p2p-rate-stale": true,
};

describe("cached rate eligibility", () => {
  test("preserves fresh and eligible stale rates, including the exact age limit", () => {
    expect(pruneExpiredRates(entry, maxAge, now)).toEqual(entry);
  });

  test("drops an expired source independently, including its metadata", () => {
    const actual = pruneExpiredRates(entry, maxAge, now + 1);
    expect(actual["bcv-rate"]).toBe(887.3);
    expect(actual).not.toHaveProperty("binance-p2p-rate");
    expect(actual).not.toHaveProperty("binance-p2p-rate-fetched-at");
    expect(actual).not.toHaveProperty("binance-p2p-rate-stale");
    expect(entry["binance-p2p-rate"]).toBe(1005.3);
  });

  test("neither source remains usable beyond the cache age limit", () => {
    const actual = pruneExpiredRates(entry, maxAge, now + maxAge + 1);
    expect(actual).toEqual({ date: entry.date });
    expect(hasRates(actual)).toBe(false);
  });

  test.each([undefined, "invalid", new Date(now + 1).toISOString()])(
    "rejects missing, invalid or future fetch timestamps: %p", (timestamp) => {
      const actual = pruneExpiredRates({ ...entry, "bcv-rate-fetched-at": timestamp }, maxAge, now);
      expect(actual).not.toHaveProperty("bcv-rate");
      expect(hasRates(actual)).toBe(true);
    },
  );

  test.each([null, undefined, 0, -1, NaN, Infinity, "887.3"])(
    "rejects invalid cached rate values: %p", (rate) => {
      const actual = pruneExpiredRates({ ...entry, "bcv-rate": rate }, maxAge, now);
      expect(actual).not.toHaveProperty("bcv-rate");
    },
  );
});
