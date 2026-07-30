const express = require("express");
const Redis = require("ioredis");
const { fetchBCVRate, fetchBinanceP2PRate } = require("./rates");

const REDIS_HOST = process.env.REDIS_HOST || "localhost";
const REDIS_PORT = parseInt(process.env.REDIS_PORT || "6380", 10);
const PORT = parseInt(process.env.PORT || "3051", 10);
const POLL_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6 hours
const TTL_SECONDS = 30 * 24 * 60 * 60; // 30 days
// How long a rate may be served from cache after its source stops responding
const MAX_STALE_DAYS = parseFloat(process.env.MAX_STALE_DAYS || "3");
const MAX_STALE_MS = MAX_STALE_DAYS * 24 * 60 * 60 * 1000;

const redis = new Redis({ host: REDIS_HOST, port: REDIS_PORT });

// Copies a rate into `entry`: the fresh value on success, otherwise the last
// cached one — but only while its last successful fetch is within MAX_STALE_DAYS,
// and always flagged so consumers can see it is not current.
function applyRate(entry, key, result, latestEntry, nowISO) {
  const fetchedAtKey = `${key}-fetched-at`;

  if (result.status === "fulfilled" && result.value != null) {
    entry[key] = result.value;
    entry[fetchedAtKey] = nowISO;
    console.log(`  ${key}: ${result.value}`);
    return;
  }

  console.error(`  ${key} fetch failed:`, result.reason || "null value");

  const cached = latestEntry && latestEntry[key];
  if (cached == null) return;

  const fetchedAt = latestEntry[fetchedAtKey];
  const age = Date.now() - Date.parse(fetchedAt);
  if (!Number.isFinite(age) || age > MAX_STALE_MS) {
    console.error(
      `  Dropping ${key}: no successful fetch since ${fetchedAt || "unknown"} (max ${MAX_STALE_DAYS}d)`
    );
    return;
  }

  entry[key] = cached;
  entry[fetchedAtKey] = fetchedAt;
  entry[`${key}-stale`] = true;
  console.log(`  Using stale ${key}: ${cached} (fetched ${fetchedAt})`);
}

async function pollRates() {
  console.log(`[${new Date().toISOString()}] Polling exchange rates...`);

  let latestEntry = null;
  try {
    const lastData = await redis.get("rate:latest");
    if (lastData) latestEntry = JSON.parse(lastData);
  } catch (err) {
    console.error("  Failed to fetch latest rate for fallback:", err.message);
  }

  const [bcvRate, binanceRate] = await Promise.allSettled([
    fetchBCVRate(),
    fetchBinanceP2PRate(),
  ]);

  const nowISO = new Date().toISOString();
  const now = nowISO.slice(0, 10); // YYYY-MM-DD
  const entry = { date: now };

  applyRate(entry, "bcv-rate", bcvRate, latestEntry, nowISO);
  applyRate(entry, "binance-p2p-rate", binanceRate, latestEntry, nowISO);

  if (entry["bcv-rate"] || entry["binance-p2p-rate"]) {
    const key = `rate:${now}`;
    await redis.set(key, JSON.stringify(entry), "EX", TTL_SECONDS);
    await redis.set("rate:latest", JSON.stringify(entry), "EX", TTL_SECONDS);
    console.log(`  Stored under ${key}`);
  }
}

const app = express();
const { renderHTML } = require("./view");

app.get("/", async (_req, res) => {
  try {
    const data = await redis.get("rate:latest");
    if (!data) {
      return res.status(503).send("No rate data available yet");
    }
    res.type("html").send(renderHTML(JSON.parse(data)));
  } catch (err) {
    console.error("Error reading from Redis:", err);
    res.status(500).send("Internal server error");
  }
});

app.get("/json", async (_req, res) => {
  try {
    const data = await redis.get("rate:latest");
    if (!data) {
      return res.status(503).json({ error: "No rate data available yet" });
    }
    res.json(JSON.parse(data));
  } catch (err) {
    console.error("Error reading from Redis:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
  // Poll immediately on start, then every 6 hours
  pollRates();
  setInterval(pollRates, POLL_INTERVAL_MS);
});
