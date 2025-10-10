import { createEngine } from "./core/engine.js";

async function importBackground(name) {
  const base = "./core/backgrounds/";
  const cand = [
    name,
    name.toLowerCase(),
    name.toUpperCase(),
    name[0].toUpperCase() + name.slice(1).toLowerCase()
  ];
  let lastErr;
  for (const n of cand) {
    try { return await import(`${base}${n}.js`); }
    catch (e) { lastErr = e; }
  }
  throw lastErr;
}

async function boot() {
  const engine = createEngine({ alpha: true, antialias: true });

  const sfondiPossibili = [
    "earth_Moon",
    "Jupiter",
    "Mars",
    "Mercury",
    "Neptune",
    "Saturn",
    "Uranus",
    "Venus"
  ];

  let raw = (document.body.dataset.bg || "random").trim();

  if (raw === "random"){
    const indiceRandom = Math.floor(Math.random() * sfondiPossibili.length)
    raw = sfondiPossibili[indiceRandom];
  }

  const mod = await importBackground(raw);
  const bg = await mod.initBackground(engine);

  engine.start();

  window.__engine = engine;
  window.__bg = bg;
}
boot();
