const { afterEach, beforeEach, describe, expect, spyOn, test } = require("bun:test");
const { fetchBCVPage, fetchBCVRate, fetchBCVEuroRate, fetchBinanceP2PRate } = require("../src/rates");
const originalFetch = globalThis.fetch;

let requests;
let warn;

beforeEach(() => {
  requests = [];
  warn = spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  warn.mockRestore();
});

function respond(data, status = 200) {
  globalThis.fetch = async () => Response.json(data, { status });
}

// Matches the markup BCV publishes, including a neighbouring currency.
function bcvBlock(id, value) {
  const amount = value == null ? "" : `<strong class="strong-tb"> ${value}</strong>`;
  return `<div id="${id}" class="col-sm-12"><div class="row recuadrotsmc">
    <span style="display: inline"> ${id} </span> </div>
    <div class="col-sm-6 centrado textp">${amount} </div></div>`;
}

function bcvPage({ usd = "896,12250000", eur = "1.004,95657762" } = {}) {
  return `<html>${bcvBlock("euro", eur)}${bcvBlock("yuan", "122,10000000")}${bcvBlock("dolar", usd)}${bcvBlock("rublo", "9,10000000")}</html>`;
}

const up = (body) => async () =>
  new Response(typeof body === "string" ? body : JSON.stringify(body));
const down = async () => new Response("unavailable", { status: 503 });
const unreachable = async () => { throw new Error("connection failed"); };

// Each source is answered separately, so a test can fail any part of the cascade.
function sources({ bcv = down, dolarapi = down, dolarflow = down }) {
  globalThis.fetch = async (url, options) => {
    const { hostname } = new URL(url);
    requests.push({ hostname, options });
    if (hostname === "www.bcv.org.ve") return bcv();
    if (hostname === "ve.dolarapi.com") return dolarapi();
    if (hostname === "dolarflow.com") return dolarflow();
    throw new Error(`Unexpected request to ${url}`);
  };
}

describe("official rate cascade", () => {
  test("reads both rates from BCV's page", async () => {
    sources({ bcv: up(bcvPage()) });
    expect(await fetchBCVRate()).toBe(896.1225);
    expect(await fetchBCVEuroRate()).toBe(1004.95657762);
    expect(requests.map((request) => request.hostname)).toEqual(["www.bcv.org.ve", "www.bcv.org.ve"]);
  });

  test("skips certificate checks for BCV and no other source", async () => {
    sources({ dolarflow: up({ exito: true, precio: 897 }) });
    await fetchBCVRate();
    expect(requests.map((request) => request.hostname)).toEqual([
      "www.bcv.org.ve", "ve.dolarapi.com", "dolarflow.com",
    ]);
    expect(requests[0].options.tls.rejectUnauthorized).toBe(false);
    expect(requests[1].options.tls).toBeUndefined();
    expect(requests[2].options.tls).toBeUndefined();
  });

  test("downloads BCV's page once when both rates share it", async () => {
    sources({ bcv: up(bcvPage()) });
    const page = fetchBCVPage();
    expect(await fetchBCVRate(page)).toBe(896.1225);
    expect(await fetchBCVEuroRate(page)).toBe(1004.95657762);
    expect(requests).toHaveLength(1);
  });

  test("does not use third parties while BCV answers", async () => {
    sources({ bcv: up(bcvPage()), dolarapi: unreachable, dolarflow: unreachable });
    expect(await fetchBCVRate()).toBe(896.1225);
    expect(requests.map((request) => request.hostname)).toEqual(["www.bcv.org.ve"]);
  });

  test("publishes the rate as it is, however far it is from the dollar", async () => {
    sources({ bcv: up(bcvPage({ usd: "896,12", eur: "50.000,00" })) });
    expect(await fetchBCVEuroRate()).toBe(50000);
    sources({ dolarapi: up({ promedio: 1.004 }) });
    expect(await fetchBCVEuroRate()).toBe(1.004);
  });

  test("the dollar falls back to dolarapi, then dolarflow", async () => {
    sources({ dolarapi: up({ promedio: 896.5 }), dolarflow: up({ exito: true, precio: 897 }) });
    expect(await fetchBCVRate()).toBe(896.5);
    sources({ bcv: unreachable, dolarflow: up({ exito: true, precio: "897.25" }) });
    expect(await fetchBCVRate()).toBe(897.25);
    expect(warn).toHaveBeenCalled();
  });

  test("the euro falls back to dolarapi, and never to dolarflow", async () => {
    sources({ bcv: unreachable, dolarapi: up({ promedio: 1004.9 }) });
    expect(await fetchBCVEuroRate()).toBe(1004.9);
    sources({ dolarflow: up({ exito: true, precio: 1.004 }) });
    await expect(fetchBCVEuroRate()).rejects.toThrow("dolarapi");
    expect(requests.map((request) => request.hostname)).not.toContain("dolarflow.com");
  });

  test("falls back for one currency when only that one is missing from the page", async () => {
    sources({ bcv: up(bcvPage({ usd: null })), dolarapi: up({ promedio: 896.5 }) });
    expect(await fetchBCVRate()).toBe(896.5);
    expect(await fetchBCVEuroRate()).toBe(1004.95657762);
  });

  test.each(["1.004", "1,004.95", "1.04,95", "896", "abc", "0,00"])(
    "falls back rather than misread BCV's number: %p", async (usd) => {
      sources({ bcv: up(bcvPage({ usd })), dolarapi: up({ promedio: 896.5 }) });
      expect(await fetchBCVRate()).toBe(896.5);
    },
  );

  test("falls back when BCV's page changes shape", async () => {
    sources({ bcv: up("<html>maintenance</html>"), dolarapi: up({ promedio: 896.5 }) });
    expect(await fetchBCVRate()).toBe(896.5);
  });

  test("names every source that failed when none answers", async () => {
    sources({ bcv: unreachable });
    const failure = fetchBCVRate();
    await expect(failure).rejects.toThrow("BCV: connection failed");
    await expect(failure).rejects.toThrow("dolarapi: returned 503");
    await expect(failure).rejects.toThrow("dolarflow: returned 503");
  });

  test.each([null, true, 0, -1, "NaN", "887.3invalid"])(
    "does not accept an unusable third-party price: %p", async (price) => {
      sources({
        dolarapi: up({ promedio: price }),
        dolarflow: up({ exito: true, precio: price }),
      });
      await expect(fetchBCVRate()).rejects.toThrow("invalid rate");
      await expect(fetchBCVEuroRate()).rejects.toThrow("invalid rate");
    },
  );

  test("does not accept a dolarflow response that reports failure", async () => {
    sources({ dolarflow: up({ exito: false, precio: 887.3 }) });
    await expect(fetchBCVRate()).rejects.toThrow("reported failure");
  });
});

describe("Binance response validation", () => {
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

  test("rejects a non-success HTTP response", async () => {
    respond({}, 503);
    await expect(fetchBinanceP2PRate()).rejects.toThrow("503");
  });
});
