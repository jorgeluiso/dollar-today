function parseRate(value) {
  if (typeof value !== "number" && typeof value !== "string") return NaN;
  return Number(value);
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const m = sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
  return parseFloat(m.toFixed(2));
}

async function fetchBCVRate() {
  const res = await fetch("https://dolarflow.com/api/oficial/", {
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`BCV API returned ${res.status}`);
  const data = await res.json();
  if (!data.exito) throw new Error("BCV API reported failure");
  const rate = parseRate(data.precio);
  if (!Number.isFinite(rate) || rate <= 0) {
    throw new Error(`BCV API returned invalid rate: ${data.precio}`);
  }
  return rate;
}

async function fetchBinanceP2PRate() {
  const res = await fetch(
    "https://p2p.binance.com/bapi/c2c/v2/friendly/c2c/adv/search",
    {
      method: "POST",
      signal: AbortSignal.timeout(15_000),
      headers: {
        "Content-Type": "application/json",
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
      body: JSON.stringify({
        asset: "USDT",
        fiat: "VES",
        merchantCheck: true,
        page: 1,
        payTypes: [],
        publisherType: null,
        rows: 20,
        tradeType: "BUY",
      }),
    }
  );

  if (!res.ok) throw new Error(`Binance P2P API returned ${res.status}`);
  const data = await res.json();
  if (data.success === false || !Array.isArray(data.data)) {
    throw new Error("Binance P2P API reported failure");
  }
  const prices = data.data
    .map((item) => parseRate(item?.adv?.price))
    .filter((price) => Number.isFinite(price) && price > 0);
  if (prices.length === 0) throw new Error("No valid Binance P2P ads returned");
  return median(prices);
}

module.exports = { fetchBCVRate, fetchBinanceP2PRate };
