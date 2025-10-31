const API_BASE = (location.port === "8080") ? "" : "http://localhost:8080";
const token = localStorage.getItem("token");

const grid = document.getElementById("albumGrid");
const statusEl = document.getElementById("albumStatus");

const overlay = document.getElementById("lightbox");
const lbImg = document.getElementById("lightboxImg");
const lbCap = document.getElementById("lightboxCap");

function setStatus(t) {
  if (statusEl) statusEl.textContent = t;
}

function niceNameFromUrl(url) {
  try {
    let name = decodeURIComponent(url.split("/").pop().split(".")[0]);
    name = name.replace(/^(card|carta|cards)[-_ ]*/i, "");
    name = name.replace(/[_-]+/g, " ").trim();
    return name;
  } catch {
    return "Carta";
  }
}

function openLightbox(src, altText) {
  lbImg.src = src;
  lbImg.alt = altText || "Carta";
  lbCap.textContent = altText || "";
  overlay.classList.add("open");
  overlay.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
}

function closeLightbox() {
  overlay.classList.remove("open");
  overlay.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
  lbImg.src = "";
}

function bindLightboxHandlers() {
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) closeLightbox();
  });
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && overlay.classList.contains("open")) {
      closeLightbox();
    }
  });
}

function renderCards(cards) {
  while (grid.firstChild) grid.removeChild(grid.firstChild);
  if (!cards || !cards.length) {
    setStatus("Nessuna carta ancora. Prova a pescare nella pagina Tenta la Fortuna.");
    return;
  }
  setStatus(`Carte: ${cards.length}/30`);

  for (const url of cards) {
    const fig = document.createElement("figure");
    fig.className = "album-item";

    const img = document.createElement("img");
    const alt = niceNameFromUrl(url);
    img.src = url;
    img.alt = alt;

    img.addEventListener("click", () => openLightbox(url, alt));

    const cap = document.createElement("figcaption");
    cap.textContent = alt;

    fig.append(img, cap);
    grid.appendChild(fig);
  }
}

async function loadCards() {
  if (!token) {
    setStatus("Effettua l'accesso per vedere l'album.");
    return;
  }
  setStatus("Caricamento…");
  try {
    const res = await fetch(`${API_BASE}/api/profilo`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      setStatus("Errore nel caricamento dell'album.");
      return;
    }
    const data = await res.json();
    const cards = data?.utente?.cards ?? [];
    renderCards(cards);
  } catch (e) {
    console.error(e);
    setStatus("Errore di rete.");
  }
}

document.addEventListener("DOMContentLoaded", () => {
  bindLightboxHandlers();
  loadCards();
});
