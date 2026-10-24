const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function renderHTML(data) {
  const date = new Date(data.date + "T00:00:00");
  const dayName = DAYS[date.getUTCDay()];
  const bcv = data["bcv-rate"] != null ? data["bcv-rate"].toFixed(2) : "—";
  const binance = data["binance-p2p-rate"] != null ? data["binance-p2p-rate"].toFixed(2) : "—";
  const staleNote = (key) =>
    data[`${key}-stale`]
      ? `<span class="stale-note">Stale — ${data[`${key}-fetched-at`].slice(0, 10)}</span>`
      : "";

  return `<!DOCTYPE html>
<html lang="en"><head>
<meta charset="utf-8"/>
<meta content="width=device-width, initial-scale=1.0" name="viewport"/>
<title>Dollar Today</title>
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet"/>
<style>
        * { box-sizing: border-box; }
        body {
            margin: 0;
            background-color: #fbf9f9;
            color: #1b1c1c;
            font-family: "Inter", sans-serif;
            line-height: 1.5;
            -webkit-font-smoothing: antialiased;
        }
        ::selection { background: #000; color: #fff; }
        main {
            min-height: 100vh;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            padding: 2rem;
            gap: 8rem;
        }
        .date-header { width: 100%; text-align: center; }
        .date-text {
            font-family: "Space Grotesk", sans-serif;
            font-weight: 500;
            letter-spacing: 0.5em;
            text-transform: uppercase;
            font-size: 0.75rem;
            line-height: 1rem;
        }
        .rates {
            width: 100%;
            max-width: 72rem;
            display: grid;
            grid-template-columns: minmax(0, 1fr);
            gap: 6rem;
            text-align: center;
        }
        .rate-card { display: flex; flex-direction: column; align-items: center; }
        .rate-value {
            margin: 0;
            font-family: "Space Grotesk", sans-serif;
            font-weight: 700;
            font-size: 6rem;
            letter-spacing: -0.05em;
            line-height: 1;
        }
        .stale-note {
            font-family: "Space Grotesk", sans-serif;
            letter-spacing: 0.3em;
            text-transform: uppercase;
            font-size: 0.6rem;
            opacity: 0.5;
            margin-top: 1rem;
        }
        @media (min-width: 768px) {
            .rates { grid-template-columns: repeat(2, minmax(0, 1fr)); }
            .rate-value { font-size: 10rem; }
        }
</style>
</head>
<body>
<main>
<!-- Date Header -->
<div class="date-header">
<span class="date-text">${dayName}, ${data.date}</span>
</div>
<!-- Exchange Rates -->
<section class="rates">
<!-- BCV Rate -->
<div class="rate-card">
<h1 class="rate-value">${bcv}</h1>
${staleNote("bcv-rate")}
</div>
<!-- Binance P2P Rate -->
<div class="rate-card">
<h1 class="rate-value">${binance}</h1>
${staleNote("binance-p2p-rate")}
</div>
</section>
</main>
</body></html>`;
}

module.exports = { renderHTML };
