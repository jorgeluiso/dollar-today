const { expect, test } = require("bun:test");
const { renderHTML } = require("../src/view");

test("renders rates with CSS and no browser JavaScript dependency", () => {
  const html = renderHTML({ date: "2026-10-24", "bcv-rate": 887.302, "binance-p2p-rate": 1005.3 });
  expect(html).toContain("887.30");
  expect(html).toContain("1005.30");
  expect(html).toContain("@media (min-width: 768px)");
  expect(html).not.toContain("<script");
  expect(html).not.toContain("tailwind");
});

const rates = {
  date: "2026-11-06",
  "bcv-rate": 896.1225,
  "bcv-euro-rate": 1004.95657762,
  "binance-p2p-rate": 1014,
};

test("labels the three rates and anchors discounts to Binance P2P by default", () => {
  const html = renderHTML(rates);
  for (const text of ["896.12", "1004.96", "1014.00", ">BCV<", ">Tasa Euro<", ">Binance P2P<"]) {
    expect(html).toContain(text);
  }
  expect(html).toContain('id="anchor-binance-p2p-rate" checked');
  expect(html).not.toContain('id="anchor-bcv-rate" checked');
});

test("renders each rate's discount against every possible anchor", () => {
  const html = renderHTML(rates);
  // Against Binance P2P, the source of truth by default.
  expect(html).toContain('vs-binance-p2p-rate">−11.6%');
  expect(html).toContain('vs-binance-p2p-rate">−0.9%');
  // Against the official rate, the others are premiums.
  expect(html).toContain('vs-bcv-rate">+13.2%');
  expect(html).toContain('vs-bcv-rate">+12.1%');
  expect(html.match(/>Anchor</g)).toHaveLength(3);
});

test("reserves the discount's space so toggling cannot move the layout", () => {
  const html = renderHTML(rates);
  expect(html).toMatch(/\.discount-slot \{[^}]*min-height[^}]*visibility: hidden/);
  expect(html).not.toContain("#show-discounts:checked ~ .rates .discount-slot { display");
});

test("rounds an insignificant difference to an unsigned zero", () => {
  const html = renderHTML({ ...rates, "bcv-euro-rate": 1014.01 });
  expect(html).toContain('vs-binance-p2p-rate">0.0%');
});

test("a missing rate cannot be an anchor, and the anchor falls back when Binance is missing", () => {
  const { "binance-p2p-rate": _, ...withoutBinance } = rates;
  const html = renderHTML(withoutBinance);
  expect(html).not.toContain('id="anchor-binance-p2p-rate"');
  expect(html).not.toContain("vs-binance-p2p-rate");
  expect(html).toContain('id="anchor-bcv-rate" checked');
  expect(html).toContain('class="rate-value">—');
  expect(html).not.toContain("NaN");
});

test("renders missing and stale rates", () => {
  const html = renderHTML({
    date: "2026-10-24",
    "binance-p2p-rate": 1005.3,
    "binance-p2p-rate-stale": true,
    "binance-p2p-rate-fetched-at": "2026-10-23T12:00:00Z",
  });
  expect(html).toContain('class="rate-value">—');
  expect(html).toContain('class="stale-note">Stale — 2026-10-23');
});
