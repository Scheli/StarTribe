// Mostra sotto al bottone il numero di biglietti dell'utente
const msgEl = document.getElementById("tickets-msg");
const token = localStorage.getItem("token");

// Usa sempre la stessa base degli altri file
const API = "http://localhost:8080";

async function getTicketsFromProfilo() {
  const res = await fetch(`${API}/api/profilo`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const data = await res.json();

  if (!res.ok || !data?.success || !data?.utente) {
    throw new Error("profilo: risposta non valida");
  }

  const raw = data.utente.tickets;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n)) throw new Error("profilo: tickets assente");
  return n;
}

async function getTicketsFromTrophy() {
  const res = await fetch(`${API}/api/trophy`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const data = await res.json();

  if (!res.ok || !data?.success) {
    throw new Error("trophy: risposta non valida");
  }

  const n = Number.parseInt(data.tickets, 10);
  return Number.isFinite(n) ? n : 0;
}

async function caricaBiglietti() {
  if (!msgEl) return;

  if (!token) {
    msgEl.textContent = "0";
    return;
  }

  try {
    const t = await getTicketsFromProfilo();
    msgEl.textContent = String(t);
  } catch (_) {
    try {
      const t2 = await getTicketsFromTrophy();
      msgEl.textContent = String(t2);
    } catch {
      msgEl.textContent = "0";
    }
  }
}

caricaBiglietti();
