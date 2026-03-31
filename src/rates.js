async function fetchBCVRate() {
  const res = await fetch("https://bcv-api.rafnixg.dev/rates/");
  if (!res.ok) throw new Error(`BCV API returned ${res.status}`);
  const data = await res.json();
  return parseFloat(data.dollar);
}

async function fetchBinanceP2PRate() {
  const res = await fetch(
    "https://p2p.binance.com/bapi/c2c/v2/friendly/c2c/adv/search",
    {
      method: "POST",
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
        rows: 10,
        tradeType: "BUY",
      }),
    }
  );

  if (!res.ok) throw new Error(`Binance P2P API returned ${res.status}`);
  const data = await res.json();
  const prices = data.data.map((item) => parseFloat(item.adv.price));
  if (prices.length === 0) throw new Error("No Binance P2P ads returned");
  const avg = prices.reduce((sum, p) => sum + p, 0) / prices.length;
  return parseFloat(avg.toFixed(2));
}

module.exports = { fetchBCVRate, fetchBinanceP2PRate };
