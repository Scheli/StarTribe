const SRC = "/frontend/assets/audio/starwars.mp3"; 
const TARGET_VOLUME = 0.35; 
const FADE_MS = 1500;

let started = false;
let cta = null;

function fadeTo(audio, target = TARGET_VOLUME, duration = FADE_MS) {
  const steps = 30;
  const step = (target - audio.volume) / steps;
  const int = duration / steps;
  const id = setInterval(() => {
    audio.volume = Math.min(target, audio.volume + step);
    if (audio.volume >= target) clearInterval(id);
  }, int);
}

function createCTA() {
  const btn = document.createElement("button");
  btn.className = "audio-cta";
  btn.type = "button";
  btn.textContent = "🔊 Attiva audio";
  btn.addEventListener("click", start, { once: true });
  document.body.appendChild(btn);
  return btn;
}

const audio = new Audio(SRC);
audio.preload = "auto";
audio.loop = false; 
audio.volume = 0;

async function start() {
  if (started) return;
  started = true;
  try {
    await audio.play();
    fadeTo(audio);
    if (cta) {
      cta.classList.add("hide");
      setTimeout(() => cta.remove(), 350);
    }
  } catch (e) {
    started = false;
  }
}

window.addEventListener("load", async () => {
  cta = createCTA();        
  try { await start(); } catch {}
});

["pointerdown", "keydown"].forEach((evt) =>
  document.addEventListener(evt, start, { once: true })
);

window.StarTribeAudio = {
  pause: () => audio.pause(),
  resume: () => audio.paused && start(),
};
