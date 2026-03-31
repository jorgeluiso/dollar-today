const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function renderHTML(data) {
  const date = new Date(data.date + "T00:00:00");
  const dayName = DAYS[date.getUTCDay()];
  const bcv = data["bcv-rate"] != null ? data["bcv-rate"].toFixed(2) : "—";
  const binance = data["binance-p2p-rate"] != null ? data["binance-p2p-rate"].toFixed(2) : "—";

  return `<!DOCTYPE html>
<html class="light" lang="en"><head>
<meta charset="utf-8"/>
<meta content="width=device-width, initial-scale=1.0" name="viewport"/>
<title>Dollar Today</title>
<script src="https://cdn.tailwindcss.com?plugins=forms,container-queries"></script>
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet"/>
<script>
      tailwind.config = {
        darkMode: "class",
        theme: {
          extend: {
            colors: {
              "surface": "#fbf9f9",
              "primary": "#000000",
              "on-surface": "#1b1c1c",
            },
            fontFamily: {
              "headline": ["Space Grotesk"],
              "body": ["Inter"],
            },
            borderRadius: {"DEFAULT": "0px", "lg": "0px", "xl": "0px", "full": "9999px"},
          },
        },
      }
</script>
<style>
        body {
            background-color: #fbf9f9;
            color: #1b1c1c;
            -webkit-font-smoothing: antialiased;
        }
        * { border-radius: 0px !important; }
</style>
</head>
<body class="font-body selection:bg-primary selection:text-on-primary">
<main class="min-h-screen flex flex-col items-center justify-center p-8 space-y-32">
<!-- Date Header -->
<div class="w-full text-center">
<span class="font-headline font-medium tracking-[0.5em] text-on-surface uppercase text-xs">${dayName}, ${data.date}</span>
</div>
<!-- Exchange Rates -->
<section class="w-full max-w-6xl grid grid-cols-1 md:grid-cols-2 gap-24 text-center">
<!-- BCV Rate -->
<div class="flex flex-col items-center">
<h1 class="font-headline font-bold text-8xl md:text-[10rem] tracking-tighter leading-none">${bcv}</h1>
</div>
<!-- Binance P2P Rate -->
<div class="flex flex-col items-center">
<h1 class="font-headline font-bold text-8xl md:text-[10rem] tracking-tighter leading-none">${binance}</h1>
</div>
</section>
</main>
</body></html>`;
}

module.exports = { renderHTML };
