const utenteId = localStorage.getItem("utenteVisualizzato");
const token = localStorage.getItem("token");

let seguitiCorrenti = [];

const DEFAULT_LOGO = "/frontend/assets/logo.png";

const TROPHY_MAP = {
  bronzo: "/frontend/assets/card/border-bronzo.png",
  argento: "/frontend/assets/card/border-argento.png",
  oro: "/frontend/assets/card/border-oro.png",
  platino: "/frontend/assets/card/border-platino.png",
  rubino: "/frontend/assets/card/border-rubino.png",
  diamante: "/frontend/assets/card/border-diamante.png",
  universo: "/frontend/assets/card/border-universo.png",
};

function isProvided(v) {
  if (v === null || v === undefined) return false;
  const s = String(v).trim().toLowerCase();
  return s !== "" && s !== "null" && s !== "undefined";
}

function resolveTrophy(value) {
  if (!isProvided(value)) return null;
  const val = String(value).trim();
  if (val.includes("/") || val.endsWith(".png")) {
    return val;
  }
  return TROPHY_MAP[val.toLowerCase()] || null;
}

// Riferimenti contatori UI
const followerCountEl = document.getElementById("followerCount");
const seguitiCountEl  = document.getElementById("seguitiCount");
const actionsEl       = document.getElementById("profiloActions");

// Funzione popup sicura (riutilizzo quella di login/registrazione)
function showPopup({ title, text, duration = 1500 }) {
  const overlay = window.safeDom.createSafeElement('div', { className: 'welcome-overlay' });
  const popupDiv = window.safeDom.createSafeElement('div', { className: 'welcome-popup' });
  const logo = window.safeDom.createSafeElement('img', {
    className: 'welcome-logo',
    src: '/frontend/assets/logo.png'
  });
  logo.alt = 'Logo';
  const titleElement = window.safeDom.createSafeElement('h2', {}, title);
  const textElement = window.safeDom.createSafeElement('p', {}, text);
  const loadingBar = window.safeDom.createSafeElement('div', { className: 'loading-bar' });
  const loadingFill = window.safeDom.createSafeElement('div', { className: 'loading-fill' });
  loadingBar.appendChild(loadingFill);
  popupDiv.append(logo, titleElement, textElement, loadingBar);
  overlay.appendChild(popupDiv);
  document.body.appendChild(overlay);
  setTimeout(() => {
    overlay.style.opacity = "0";
    overlay.style.transition = "opacity 0.5s ease";
    setTimeout(() => overlay.remove(), 600);
  }, duration);
}

function setCountsFromUser(u) {
  const follower = Array.isArray(u.follower) ? u.follower.length : 0;
  const seguiti  = Array.isArray(u.seguiti)  ? u.seguiti.length  : 0;
  if (followerCountEl) followerCountEl.textContent = String(follower);
  if (seguitiCountEl)  seguitiCountEl.textContent  = String(seguiti);
}

function incFollowerTarget(delta) {
  if (!followerCountEl) return;
  const current = parseInt(followerCountEl.textContent || "0", 10);
  const next = Math.max(0, current + delta);
  followerCountEl.textContent = String(next);
}

if (!utenteId) {
  showPopup({
    title: "Errore",
    text: "Utente non selezionato",
    duration: 1500
  });
} else {
  // Carica profilo target
  fetch(`http://localhost:8080/api/utente/${utenteId}`)
    .then(res => res.json())
    .then(data => {
      if (!data.success || !data.utente) {
        showPopup({
          title: "Errore",
          text: window.safeDom.sanitizeText(data.message || "Impossibile caricare il profilo."),
          duration: 1500
        });
        return;
      }

      const u = data.utente;

      document.getElementById("username").innerText = u.username ?? "Utente";
      document.getElementById("punti").innerText = u.punti ?? 0;

      const imgProfilo = document.getElementById("immagineProfilo");
      imgProfilo.style.width = "200px";
      imgProfilo.src = isProvided(u.immagineProfilo) ? u.immagineProfilo : "/frontend/img/default-avatar-icon-of-social-media-user-vector.jpg";

      const borderImg = document.getElementById("selectedBorder");
      const trophySrc = resolveTrophy(u.selectedBorder);
      borderImg.src = trophySrc || DEFAULT_LOGO;

      if (isProvided(u.bannerProfilo)) {
        document.getElementById("banner").innerHTML =
          `<img src="${window.safeDom.sanitizeText(u.bannerProfilo)}" style="width: 100%; max-height: 500px; object-fit: cover; object-position: top;">`;
    
      } else {
        document.getElementById("banner").innerHTML =
          `<img src="/frontend/img/default_banner.jpg" style="width: 100%; max-height: 500px; object-fit: cover; object-position: top;">`;
      }
      setCountsFromUser(u);

      if (token) {
        fetch("http://localhost:8080/api/profilo", {
          headers: { Authorization: `Bearer ${token}` }
        })
          .then(res => res.json())
          .then(authData => {
            const mioId = authData?.utente?._id;
            if (!mioId) return;

            seguitiCorrenti = Array.isArray(authData.utente.seguiti) ? authData.utente.seguiti : [];

            
            // Se sto guardando me stesso, niente bottone
            if (mioId === utenteId) return;

            const btn = document.createElement("button");
            btn.id = "btnFollow";

            const already = seguitiCorrenti.some(x => {
              if (typeof x === "string") return x === utenteId;
              if (x && typeof x === "object") return x._id === utenteId || x.id === utenteId;
              return false;
            });

            btn.textContent = already ? "Seguito" : "Segui";

            btn.onclick = async () => {
              if (btn.textContent === "Segui") {
                const ok = await seguiUtente(utenteId, btn);
                if (ok) {
                  if (!seguitiCorrenti.includes(utenteId)) seguitiCorrenti.push(utenteId);
                  incFollowerTarget(1);
                }
              } else {
                const ok = await unfollowUtente(utenteId, btn);
                if (ok) {
                  seguitiCorrenti = seguitiCorrenti.filter(id => id !== utenteId);
                  incFollowerTarget(-1);
                }
              }
            };

            (actionsEl || document.getElementById("profiloEsterno")).appendChild(btn);
          })
          .catch(() => {});
      }
    })
    .catch(err => {
      console.error("Errore caricamento profilo:", err);
      showPopup({
        title: "Errore",
        text: "Errore caricamento profilo",
        duration: 1500
      });
    });
}

async function seguiUtente(idSeguito, bottone) {
  try {
    const res = await fetch("http://localhost:8080/api/segui", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ utenteDaSeguireId: idSeguito })
    });

    const data = await res.json();

    if (data.success) {
      // Aggiorna bottone
      bottone.textContent = "💖 Piaciuto";
      bottone.classList.add("liked");

      // Se vuoi aggiornare i punti visivamente nel frontend
      aggiornaPuntiUtenteAutore(postId, +100);

      showPopup({
        title: "Like aggiunto",
        text: "Hai messo mi piace! L'autore ha guadagnato 100 punti 🎉",
        duration: 1200
      });

      return true;
    } else {
      showPopup({
        title: "Errore",
        text: window.safeDom.sanitizeText(data.message || "Impossibile seguire l'utente."),
        duration: 1500
      });
      return false;
    }
  } catch (err) {
    console.error("Errore durante il follow:", err);
    showPopup({
      title: "Errore",
      text: "Errore durante la richiesta follow",
      duration: 1500
    });
    return false;
  }
}


async function togliLike(postId, bottone) {
  try {
    const res = await fetch("http://localhost:8080/api/unfollow", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ utenteDaSmettereId: id })
    });

    const data = await res.json();

    if (data.success) {
      bottone.textContent = "🤍 Mi piace";
      bottone.classList.remove("liked");

      // Aggiorna i punti nel frontend se necessario
      aggiornaPuntiUtenteAutore(postId, -100);

      showPopup({
        title: "Like rimosso",
        text: "Hai tolto il mi piace. All'autore sono stati rimossi 100 punti.",
        duration: 1200
      });

      return true;
    } else {
      showPopup({
        title: "Errore",
        text: window.safeDom.sanitizeText(data.message || "Impossibile smettere di seguire l'utente."),
        duration: 1500
      });
      return false;
    }
  } catch (err) {
    console.error("Errore durante unfollow:", err);
    showPopup({
      title: "Errore",
      text: "Errore durante la richiesta unfollow",
      duration: 1500
    });
    return false;
  }
}