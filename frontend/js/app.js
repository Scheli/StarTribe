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

async function setBackground(name, engine) {
  try {
    const mod = await importBackground(name);
    
    if (window.__bg?.dispose) window.__bg.dispose();

    const bg = await mod.initBackground(engine);

    document.body.dataset.bg = name;
    localStorage.setItem("selectedBgPlanet", name);

    window.__bg = bg;
  } catch (e) {
    console.error("Errore durante il cambio background:", e);
  }
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

  if (raw === "random") {
    const indiceRandom = Math.floor(Math.random() * sfondiPossibili.length);
    raw = sfondiPossibili[indiceRandom];
  }

  await setBackground(raw, engine);
  engine.start();

  window.__engine = engine;

  document.querySelectorAll(".card[data-planet]").forEach(card => {
    card.addEventListener("click", async (e) => {
      e.preventDefault();
      const selected = card.dataset.planet;
      await setBackground(selected, engine);
    });
  });
}

boot();
