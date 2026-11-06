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

// Tries each source in order of confidence and returns the first usable rate.
async function firstAvailable(rateName, sources) {
  const failures = [];
  for (const [sourceName, fetchRate] of sources) {
    try {
      const rate = await fetchRate();
      if (failures.length > 0) {
        console.warn(`  ${rateName}: using ${sourceName} after ${failures.join("; ")}`);
      }
      return rate;
    } catch (err) {
      failures.push(`${sourceName}: ${err.message}`);
    }
  }
  throw new Error(failures.join("; "));
}

// The source of truth. Download it once per poll and pass it to both BCV rates.
// BCV's server has a broken certificate chain, and being the authority it still
// comes first, so this one request accepts that gap. No other source skips checks.
async function fetchBCVPage() {
  const res = await fetch("https://www.bcv.org.ve/", {
    signal: AbortSignal.timeout(15_000),
    tls: { rejectUnauthorized: false },
  });
  if (!res.ok) throw new Error(`returned ${res.status}`);
  return res.text();
}

// BCV writes numbers the Venezuelan way: 1.004,95657762. Requiring that exact shape
// is what stops "1.004,95" being read as 1.004.
function parseBCVNumber(text) {
  if (!/^(\d+|\d{1,3}(\.\d{3})+),\d+$/.test(text)) return NaN;
  return Number(text.replaceAll(".", "").replace(",", "."));
}

async function readBCVPageRate(page, currencyId) {
  const html = await page;
  // Stops at the next id, so a missing value cannot be taken from another currency.
  const match = html.match(
    new RegExp(`id="${currencyId}"(?:(?!id=")[\\s\\S])*?<strong[^>]*>\\s*([^<]+?)\\s*</strong>`)
  );
  if (!match) throw new Error(`no ${currencyId} rate on the page`);
  const rate = parseBCVNumber(match[1]);
  if (!Number.isFinite(rate) || rate <= 0) throw new Error(`invalid rate: ${match[1]}`);
  return rate;
}

async function fetchDolarApiRate(path) {
  const res = await fetch(`https://ve.dolarapi.com/v1/${path}`, {
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`returned ${res.status}`);
  const data = await res.json();
  const rate = parseRate(data.promedio);
  if (!Number.isFinite(rate) || rate <= 0) throw new Error(`invalid rate: ${data.promedio}`);
  return rate;
}

async function fetchDolarflowRate() {
  const res = await fetch("https://dolarflow.com/api/oficial/", {
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`returned ${res.status}`);
  const data = await res.json();
  if (!data.exito) throw new Error("reported failure");
  const rate = parseRate(data.precio);
  if (!Number.isFinite(rate) || rate <= 0) throw new Error(`invalid rate: ${data.precio}`);
  return rate;
}

function fetchBCVRate(page = fetchBCVPage()) {
  return firstAvailable("bcv-rate", [
    ["BCV", () => readBCVPageRate(page, "dolar")],
    ["dolarapi", () => fetchDolarApiRate("dolares/oficial")],
    ["dolarflow", fetchDolarflowRate],
  ]);
}

// dolarflow is not a fallback here: its euro endpoint reads 1.004,95 as 1.004.
function fetchBCVEuroRate(page = fetchBCVPage()) {
  return firstAvailable("bcv-euro-rate", [
    ["BCV", () => readBCVPageRate(page, "euro")],
    ["dolarapi", () => fetchDolarApiRate("euros/oficial")],
  ]);
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

module.exports = { fetchBCVPage, fetchBCVRate, fetchBCVEuroRate, fetchBinanceP2PRate };
