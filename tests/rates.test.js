const { afterEach, describe, expect, test } = require("bun:test");
const { fetchBCVRate, fetchBinanceP2PRate } = require("../src/rates");
const originalFetch = globalThis.fetch;

afterEach(() => { globalThis.fetch = originalFetch; });

function respond(data, status = 200) {
  globalThis.fetch = async () => Response.json(data, { status });
}

describe("provider response validation", () => {
  test("accepts the official BCV rate", async () => {
    respond({ exito: true, precio: "887.302" });
    expect(await fetchBCVRate()).toBe(887.302);
  });

  test.each([null, true, 0, -1, "NaN", "887.3invalid"])(
    "rejects invalid BCV prices: %p", async (price) => {
      respond({ exito: true, precio: price });
      await expect(fetchBCVRate()).rejects.toThrow("invalid rate");
    },
  );

  test("rejects a BCV provider failure", async () => {
    respond({ exito: false, precio: 887.3 });
    await expect(fetchBCVRate()).rejects.toThrow("reported failure");
  });

  test("takes the median of valid Binance ads, ignoring malformed ads", async () => {
    respond({ success: true, data: [
      { adv: { price: "1020" } }, { adv: { price: "1000" } },
      { adv: { price: "1010" } }, { adv: { price: "invalid" } },
      { adv: { price: "1009invalid" } }, { adv: { price: -1 } },
      { adv: { price: true } }, {}, null,
    ] });
    expect(await fetchBinanceP2PRate()).toBe(1010);
  });

  test("averages the two central prices in an even-sized sample", async () => {
    respond({ success: true, data: [1001, 1002, 1003, 1004].map((price) => ({ adv: { price } })) });
    expect(await fetchBinanceP2PRate()).toBe(1002.5);
  });

  test.each([{ success: false, data: [] }, {}, { data: null }])(
    "rejects Binance failures and unexpected response shapes: %p", async (data) => {
      respond(data);
      await expect(fetchBinanceP2PRate()).rejects.toThrow("reported failure");
    },
  );

  test("rejects a response with no usable ads", async () => {
    respond({ success: true, data: [{ adv: { price: "invalid" } }] });
    await expect(fetchBinanceP2PRate()).rejects.toThrow("No valid");
  });

  test("rejects non-success HTTP responses from either provider", async () => {
    respond({}, 503);
    await expect(fetchBCVRate()).rejects.toThrow("503");
    await expect(fetchBinanceP2PRate()).rejects.toThrow("503");
  });
});
