const express = require("express");
const Redis = require("ioredis");
const { fetchBCVRate, fetchBinanceP2PRate } = require("./rates");

const REDIS_HOST = process.env.REDIS_HOST || "localhost";
const REDIS_PORT = parseInt(process.env.REDIS_PORT || "6379", 10);
const PORT = parseInt(process.env.PORT || "3051", 10);
const POLL_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6 hours
const TTL_SECONDS = 30 * 24 * 60 * 60; // 30 days

const redis = new Redis({ host: REDIS_HOST, port: REDIS_PORT });

async function pollRates() {
  console.log(`[${new Date().toISOString()}] Polling exchange rates...`);

  const [bcvRate, binanceRate] = await Promise.allSettled([
    fetchBCVRate(),
    fetchBinanceP2PRate(),
  ]);

  const now = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const entry = { date: now };

  if (bcvRate.status === "fulfilled" && bcvRate.value != null) {
    entry["bcv-rate"] = bcvRate.value;
    console.log(`  BCV rate: ${bcvRate.value}`);
  } else {
    console.error("  BCV rate fetch failed:", bcvRate.reason || "null value");
  }

  if (binanceRate.status === "fulfilled" && binanceRate.value != null) {
    entry["binance-p2p-rate"] = binanceRate.value;
    console.log(`  Binance P2P rate: ${binanceRate.value}`);
  } else {
    console.error(
      "  Binance P2P rate fetch failed:",
      binanceRate.reason || "null value"
    );
  }

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
