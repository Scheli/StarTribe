import { createEngine } from "./core/engine.js";
import { FocusBus } from "./core/utils.js";

if (window.__STARTRIBE_BOOTED__) {
  try { window.__bg?.dispose?.(); window.__engine?.dispose?.(); } catch {}
}
window.__STARTRIBE_BOOTED__ = true;

/* ---------- import dinamico background ---------- */
async function importBackground(name) {
  const base = "./core/backgrounds/";
  const tries = [
    name,
    name?.toLowerCase?.(),
    name?.toUpperCase?.(),
    name ? name[0].toUpperCase() + name.slice(1).toLowerCase() : name
  ].filter(Boolean);
  let lastErr;
  for (const n of tries) {
    try { return await import(`${base}${n}.js`); }
    catch (e) { lastErr = e; }
  }
  throw lastErr;
}

let currentBgLoad = null;

async function setBackground(name, engine) {
  const canvas = document.querySelector("canvas[data-startribe='engine']");
  if (!canvas) return;

  if (currentBgLoad) return;
  const token = {};
  currentBgLoad = token;

  try {
    canvas.style.transition = "opacity 500ms ease-in-out";
    canvas.style.opacity = 0;

    const mod = await importBackground(name);
    if (currentBgLoad !== token) return;

    if (window.__bg?.dispose) { try { window.__bg.dispose(); } catch {} }
    window.__bg = null;

    for (let i = engine.scene.children.length - 1; i >= 0; i--) {
      engine.scene.remove(engine.scene.children[i]);
    }
    if (engine.composer?.passes?.length > 1) {
      engine.composer.passes = engine.composer.passes.slice(0, 1);
    }

    const bg = await mod.initBackground(engine);
    if (currentBgLoad !== token) { bg?.dispose?.(); return; }

    window.__bg = bg;
    document.body.dataset.bg = name;
    localStorage.setItem("selectedBgPlanet", name);

    /* -------------------- fade sincronizzato via FocusBus -------------------- */
    const FADE_MS  = 900; // durata del fade-in
    const ANTICIPO = 700; // quanto prima della fine del focus far partire il fade

    canvas.style.transition = `opacity ${FADE_MS}ms ease-in-out`;

    if (window.__fadeUnsub) { try { window.__fadeUnsub(); } catch {} window.__fadeUnsub = null; }
    if (window.__fadeTimer) { clearTimeout(window.__fadeTimer); window.__fadeTimer = null; }

    await new Promise(resolve => {
      let done = false;

      const fadeInNow = () => {
        if (done) return;
        done = true;
        canvas.style.opacity = 1;
        if (window.__fadeUnsub) { window.__fadeUnsub(); window.__fadeUnsub = null; }
        if (window.__fadeTimer) { clearTimeout(window.__fadeTimer); window.__fadeTimer = null; }
        resolve();
      };

     window.__fadeUnsub = FocusBus.on(evt => {
      if (!evt) return;
      
      if (evt.type === "focusEnd") {
        if (window.__fadeTimer) clearTimeout(window.__fadeTimer);
        const FADE_DELAY = 200; 
        window.__fadeTimer = setTimeout(fadeInNow, FADE_DELAY);
      }
    });

      window.__fadeTimer = setTimeout(fadeInNow, 4000);
    });

  } catch (e) {
    console.error("Errore durante il cambio background:", e);
    try { canvas.style.opacity = 1; } catch {}
  } finally {
    if (currentBgLoad === token) currentBgLoad = null;
  }
}

async function boot() {
  document.querySelectorAll('canvas[data-startribe="engine"]').forEach((c, i) => {
    if (i) c.remove();
  });

  const engine = createEngine({ alpha: true, antialias: true });
  engine.start();

  const options = ["earth_Moon","Jupiter","Mars","Mercury","Neptune","Saturn","Uranus","Venus"];
  let raw = (document.body.dataset.bg || "random").trim();
  if (raw === "random") raw = options[Math.floor(Math.random() * options.length)];

  await setBackground(raw, engine);

  requestAnimationFrame(() => {
    const cv = document.querySelector("canvas[data-startribe='engine']");
    if (cv) cv.style.opacity = 1;
  });

  window.__engine = engine;

  if (!window.__cardsBound__) {
    document.querySelectorAll(".card[data-planet]").forEach(card => {
      card.addEventListener("click", async (e) => {
        e.preventDefault();
        e.stopPropagation();
        await setBackground(card.dataset.planet, engine);
      });
    });
    window.__cardsBound__ = true;
  }

  // cleanup
  window.addEventListener("beforeunload", () => {
    try { window.__bg?.dispose?.(); } catch {}
    try { engine?.dispose?.(); } catch {}
  }, { once: true });
}

boot();
