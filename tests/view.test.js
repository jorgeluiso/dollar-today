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
