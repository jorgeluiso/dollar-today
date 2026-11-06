const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const RATES = [
  { key: "bcv-rate", label: "BCV" },
  { key: "bcv-euro-rate", label: "Tasa Euro" },
  { key: "binance-p2p-rate", label: "Binance P2P" },
];

// How far `rate` sits from `anchor`: what someone accepting `rate` gives up
// (negative, a discount) or gains (positive) if `anchor` is the true value.
function formatDiscount(rate, anchor) {
  const percent = ((rate / anchor - 1) * 100).toFixed(1);
  if (Number(percent) === 0) return "0.0%";
  return percent.startsWith("-") ? `−${percent.slice(1)}%` : `+${percent}%`;
}

function renderHTML(data) {
  const date = new Date(data.date + "T00:00:00");
  const dayName = DAYS[date.getUTCDay()];
  const available = RATES.filter(({ key }) => data[key] != null);
  const defaultAnchor = data["binance-p2p-rate"] != null ? "binance-p2p-rate" : available[0]?.key;
  const staleNote = (key) =>
    data[`${key}-stale`]
      ? `<span class="stale-note">Stale — ${data[`${key}-fetched-at`].slice(0, 10)}</span>`
      : "";

  // Every anchor's percentages are rendered up front. The hidden radios and the
  // checkbox choose which show, so the page needs no browser JavaScript.
  const anchorInputs = available
    .map(({ key }) =>
      `<input class="control" type="radio" name="anchor" id="anchor-${key}"${key === defaultAnchor ? " checked" : ""} aria-label="Measure discounts against this rate"/>`)
    .join("\n");
  const anchorRules = available
    .map(({ key }) => `
        #anchor-${key}:checked ~ .rates .vs-${key} { display: inline; }
        #anchor-${key}:focus-visible ~ .rates label[for="anchor-${key}"] { outline: 2px solid currentColor; outline-offset: 0.5rem; }`)
    .join("");

  const discountSlot = (key) =>
    available
      .map((anchor) =>
        `<span class="discount vs-${anchor.key}">${anchor.key === key ? "Anchor" : formatDiscount(data[key], data[anchor.key])}</span>`)
      .join("");

  const rateCard = ({ key, label }) => {
    const hasRate = data[key] != null;
    const value = `<span class="rate-value">${hasRate ? data[key].toFixed(2) : "—"}</span>\n<span class="rate-label">${label}</span>`;
    return `<div class="rate-card">
${hasRate ? `<label class="rate-tap" for="anchor-${key}">\n${value}\n</label>` : `<div class="rate-tap">\n${value}\n</div>`}
<span class="discount-slot">${hasRate ? discountSlot(key) : ""}</span>
${staleNote(key)}
</div>`;
  };

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
            gap: 5rem;
        }
        .date-header { width: 100%; text-align: center; }
        .date-text, .rate-label, .discount, .stale-note, .toggle {
            font-family: "Space Grotesk", sans-serif;
            text-transform: uppercase;
        }
        .date-text {
            font-weight: 500;
            letter-spacing: 0.5em;
            font-size: 0.75rem;
            line-height: 1rem;
        }
        .rates {
            width: 100%;
            max-width: 80rem;
            display: grid;
            grid-template-columns: minmax(0, 1fr);
            gap: 3.5rem;
            text-align: center;
        }
        .rate-card { display: flex; flex-direction: column; align-items: center; }
        .rate-tap { display: flex; flex-direction: column; align-items: center; }
        .rate-value {
            font-family: "Space Grotesk", sans-serif;
            font-weight: 700;
            font-size: min(6rem, 21vw);
            letter-spacing: -0.05em;
            line-height: 1;
        }
        .rate-label {
            letter-spacing: 0.3em;
            font-size: 0.65rem;
            opacity: 0.6;
            margin-top: 0.75rem;
        }
        .discount-slot {
            min-height: 1.25rem;
            margin-top: 0.25rem;
            visibility: hidden;
        }
        .discount {
            display: none;
            font-size: 0.8rem;
            font-weight: 500;
            font-variant-numeric: tabular-nums;
        }
        .stale-note {
            letter-spacing: 0.3em;
            font-size: 0.6rem;
            opacity: 0.5;
            margin-top: 0.5rem;
        }
        /* Fixed, so focusing one after a tap never scrolls the page. */
        .control {
            position: fixed;
            top: 50%;
            left: 50%;
            width: 1px;
            height: 1px;
            margin: 0;
            opacity: 0;
            pointer-events: none;
        }
        .toggle {
            display: inline-flex;
            align-items: center;
            gap: 0.5rem;
            letter-spacing: 0.3em;
            font-size: 0.6rem;
            cursor: pointer;
            user-select: none;
            opacity: 0.6;
        }
        .toggle-switch {
            position: relative;
            width: 1.5rem;
            height: 0.75rem;
            border: 1px solid currentColor;
            border-radius: 1rem;
        }
        .toggle-switch::after {
            content: "";
            position: absolute;
            top: 1px;
            left: 1px;
            width: 0.5rem;
            height: 0.5rem;
            border-radius: 50%;
            background: currentColor;
        }
        #show-discounts:checked ~ .toggle { opacity: 1; }
        #show-discounts:checked ~ .toggle .toggle-switch::after { left: auto; right: 1px; }
        #show-discounts:focus-visible ~ .toggle .toggle-switch { outline: 2px solid currentColor; outline-offset: 2px; }
        #show-discounts:checked ~ .rates .discount-slot { visibility: visible; }
        #show-discounts:checked ~ .rates label.rate-tap { cursor: pointer; }
        #show-discounts:not(:checked) ~ .control { visibility: hidden; }
        #show-discounts:not(:checked) ~ .rates label.rate-tap { pointer-events: none; }${anchorRules}
        @media (min-width: 768px) {
            .rates { grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 2rem; }
            .rate-value { font-size: min(7vw, 7rem); }
        }
</style>
</head>
<body>
<main>
<input class="control" type="checkbox" id="show-discounts" aria-label="Show discounts"/>
${anchorInputs}
<!-- Date Header -->
<div class="date-header">
<span class="date-text">${dayName}, ${data.date}</span>
</div>
<!-- Exchange Rates -->
<section class="rates">
${RATES.map(rateCard).join("\n")}
</section>
<label class="toggle" for="show-discounts"><span class="toggle-switch"></span>Discount</label>
</main>
</body></html>`;
}

module.exports = { renderHTML };
