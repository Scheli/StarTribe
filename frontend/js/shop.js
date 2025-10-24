const btn = document.querySelector(".cta-button");
const msg = document.getElementById("tickets-msg");
const stage = document.querySelector(".shenron-stage");
const token = localStorage.getItem("token");

const API_BASE = (location.port === "8080") ? "" : "http://localhost:8080";

let drawing = false;

function setMsg(text) { if (msg) msg.textContent = text; }

function lockButton(ms = 2000) {
  if (!btn) return;
  if (btn.dataset.locked === "1") return;        
  btn.dataset.locked = "1";
  btn.setAttribute("aria-disabled", "true");
  btn.style.pointerEvents = "none";
  btn.style.opacity = "0.6";
  btn.style.cursor = "not-allowed";
  setTimeout(() => {
    btn.removeAttribute("aria-disabled");
    btn.style.pointerEvents = "";
    btn.style.opacity = "";
    btn.style.cursor = "";
    delete btn.dataset.locked;
  }, ms);
}

async function getTickets() {
  if (!token) { setMsg("Effettua l'accesso per usare i biglietti."); return 0; }
  try {
    let r = await fetch(`${API_BASE}/api/profilo`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (r.ok) {
      const data = await r.json();
      const t = data?.utente?.tickets ?? 0;
      setMsg(`Biglietti: ${t}`);
      return t;
    }
  } catch (_) {}

  try {
    const r2 = await fetch(`${API_BASE}/api/trophy`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (r2.ok) {
      const data2 = await r2.json();
      const t2 = data2?.tickets ?? 0;
      setMsg(`Biglietti: ${t2}`);
      return t2;
    }
  } catch (_) {}

  setMsg("Biglietti: 0");
  return 0;
}

function showDrawAnimation(cardUrl) {
  const img = document.createElement("img");
  img.src = cardUrl;
  img.alt = "Carta pescata";
  img.className = "drawn-card";
  stage.appendChild(img);

  img.addEventListener("animationend", (e) => {
    if (e.animationName === "cardFadeOut") {
      img.remove();
    } else {
      img.classList.add("fadeout");
    }
  });
}

async function drawCard() {
  if (!token) { setMsg("Devi accedere per pescare."); return; }
  if (drawing) return;
  drawing = true;
  btn.setAttribute("aria-busy", "true");

  try {
    const r = await fetch(`${API_BASE}/api/cards/draw`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await r.json();

    if (!r.ok || !data.success) {
      setMsg(data?.message || "Errore durante la pesca.");
      return;
    }

    setMsg(`Biglietti: ${data.tickets}`);
    showDrawAnimation(data.card);
  } catch {
    setMsg("Errore di rete.");
  } finally {
    drawing = false;
    btn.removeAttribute("aria-busy");
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  await getTickets();
  if (btn) {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      lockButton(2000);   
      drawCard();
    });
  }
});
