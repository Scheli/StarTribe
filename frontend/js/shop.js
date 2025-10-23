const msgEl = document.getElementById("tickets-msg");
const token = localStorage.getItem("token");
const API = "http://localhost:8080";

let lastCardImg = null;
function showCard(url) {
  if (!url) return;
  if (!lastCardImg) {
    lastCardImg = document.createElement("img");
    lastCardImg.alt = "Carta ottenuta";
    lastCardImg.style.display = "block";
    lastCardImg.style.marginTop = "10px";
    lastCardImg.style.maxWidth = "180px";
    lastCardImg.style.borderRadius = "12px";
    msgEl?.insertAdjacentElement("afterend", lastCardImg);
  }
  lastCardImg.src = url;
}

async function getTicketsFromProfilo() {
  const res = await fetch(`${API}/api/profilo`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const data = await res.json();

  if (!res.ok || !data?.success || !data?.utente) {
    throw new Error("profilo: risposta non valida");
  }
  const n = Number.parseInt(data.utente.tickets, 10);
  if (!Number.isFinite(n)) throw new Error("profilo: tickets assente");
  return n;
}

async function getTicketsFromTrophy() {
  const res = await fetch(`${API}/api/trophy`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const data = await res.json();
  if (!res.ok || !data?.success) throw new Error("trophy: risposta non valida");
  const n = Number.parseInt(data.tickets, 10);
  return Number.isFinite(n) ? n : 0;
}

async function caricaBiglietti() {
  if (!msgEl) return 0;
  if (!token) {
    msgEl.textContent = "0";
    return 0;
  }
  try {
    const t = await getTicketsFromProfilo();
    msgEl.textContent = String(t);
    return t;
  } catch {
    try {
      const t2 = await getTicketsFromTrophy();
      msgEl.textContent = String(t2);
      return t2;
    } catch {
      msgEl.textContent = "0";
      return 0;
    }
  }
}

function disableButton(btn, disabled) {
  if (!btn) return;
  if (disabled) {
    btn.setAttribute("aria-disabled", "true");
    btn.style.pointerEvents = "none";
    btn.style.opacity = "0.6";
  } else {
    btn.removeAttribute("aria-disabled");
    btn.style.pointerEvents = "";
    btn.style.opacity = "";
  }
}

async function usaTicketEPescaCarta() {
  const res = await fetch(`${API}/api/tickets/use`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` }
  });
  const data = await res.json();

  if (!res.ok || !data?.success) {
    if (typeof data?.tickets === "number" && msgEl) {
      msgEl.textContent = String(data.tickets);
    }
    throw new Error(data?.message || "Errore nell'uso del ticket");
  }
  return { tickets: Number.parseInt(data.tickets, 10) || 0, card: data.card };
}

(async () => {
  const btn = document.querySelector(".cta-button");
  const t = await caricaBiglietti();
  if (btn && t <= 0) disableButton(btn, true);

  if (btn) {
    btn.addEventListener("click", async (e) => {
      e.preventDefault();
      if (!token) return;

      btn.setAttribute("aria-busy", "true");
      disableButton(btn, true);

      try {
        const { tickets: nuovi, card } = await usaTicketEPescaCarta();
        if (msgEl) msgEl.textContent = String(nuovi);
        if (card) showCard(card);

        if (nuovi <= 0) {
          disableButton(btn, true);
        } else {
          disableButton(btn, false);
        }
      } catch (err) {
        console.error(err);
      } finally {
        btn.removeAttribute("aria-busy");
      }
    });
  }
})();
