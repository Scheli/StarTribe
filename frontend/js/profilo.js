const token = localStorage.getItem("token");

const BORDER_URLS = Object.freeze({
  bronzo:   "https://res.cloudinary.com/dprigpdai/image/upload/v1755211493/trophy-bronzo_xl2hkq.png",
  argento:  "https://res.cloudinary.com/dprigpdai/image/upload/v1755211494/trophy-argento_lckpvi.png",
  oro:      "https://res.cloudinary.com/dprigpdai/image/upload/v1755211491/trophy-oro_lrt8tr.png",
  platino:  "https://res.cloudinary.com/dprigpdai/image/upload/v1755211490/trophy-platino_k95tal.png",
  rubino:   "https://res.cloudinary.com/dprigpdai/image/upload/v1755211490/trophy-rubino_odsmnm.png",
  diamante: "https://res.cloudinary.com/dprigpdai/image/upload/v1755211490/trophy-diamante_ozndke.png",
  universo: "https://res.cloudinary.com/dprigpdai/image/upload/v1755211489/trophy-universo_xleqpr.png",
});

function eVideo(url) {
  if (!url || typeof url !== "string") return false;
  try {
    const u = new URL(url, window.location.origin);
    const p = u.pathname.toLowerCase();
    return p.endsWith(".mp4") || p.endsWith(".webm") || p.endsWith(".mov");
  } catch {
    return /\.(mp4|webm|mov)$/i.test(url);
  }
}

function safeBirthdateStr(bd) {
  if (!bd) return "";
  if (typeof bd === "string" && bd.includes("T")) return bd.split("T")[0];
  if (/^\d{4}-\d{2}-\d{2}$/.test(bd)) return bd;
  try {
    const d = new Date(bd);
    if (!isNaN(d.getTime())) return d.toISOString().split("T")[0];
  } catch {}
  return "";
}

async function resJsonSafe(res) {
  try { return await res.json(); } 
  catch { return { success:false, message:"Errore JSON" }; } 
}

function isHttpUrl(v) { return typeof v === "string" && /^https?:\/\//i.test(v); }
function keyFromBorderUrl(url) { /* ... come nel tuo codice originale ... */ return "none"; }
function getBorderUrl(v) { if (!v) return ""; if (isHttpUrl(v)) return v; return BORDER_URLS[String(v).toLowerCase()] || ""; }
function keyFromAny(v) { if (!v) return "none"; return isHttpUrl(v) ? keyFromBorderUrl(v) : String(v).toLowerCase(); }

let CURRENT = {
  avatarBaseUrl: "",
  unlocked: [],
  selectedBorder: "none",
  followerIds: [],
  seguitiIds: []
};

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

async function caricaProfilo() {
  if (!token) {
    showPopup({
      title: "Errore",
      text: "Token mancante. Esegui il login.",
      duration: 1500
    });
    return;
  }

  try {
    // --- Fetch dati utente ---
    const res = await fetch("http://localhost:8080/api/profilo", {
      headers: { Authorization: "Bearer " + token }
    });
    const data = await res.json();
    if (!data.success) {
      showPopup({
        title: "Errore",
        text: window.safeDom.sanitizeText(data.message || "Accesso negato"),
        duration: 1500
      });
      return;
    }

    const utente = data.utente;

    // --- Info base ---
    document.getElementById("usernameDisplay").textContent = utente.username;
    document.getElementById("emailDisplay").textContent    = utente.email;
    document.getElementById("birthdateDisplay").textContent= safeBirthdateStr(utente.birthdate);
    document.getElementById("puntiDisplay").textContent    = utente.punti;
    document.getElementById("navUsername").textContent = utente.username;

    // --- Contatori + ids ---
    CURRENT.followerIds = Array.isArray(utente.follower) ? utente.follower.map(f => f.$oid || f) : [];
    CURRENT.seguitiIds  = Array.isArray(utente.seguiti)  ? utente.seguiti.map(s => s.$oid || s) : [];
    document.getElementById("countFollower").textContent = CURRENT.followerIds.length;
    document.getElementById("countSeguiti").textContent  = CURRENT.seguitiIds.length;

    // --- Click per aprire box centrale ---
    document.getElementById("openFollower").onclick = () => openUserList("follower");
    document.getElementById("openSeguiti").onclick  = () => openUserList("seguiti");

    // --- Modale inputs ---
    document.getElementById("usernameInput").value  = utente.username;
    document.getElementById("birthdateInput").value = safeBirthdateStr(utente.birthdate);

    // --- Media profilo ---
    CURRENT.avatarBaseUrl  = utente.immagineProfilo || "/frontend/img/default-avatar-icon-of-social-media-user-vector.jpg";
    CURRENT.selectedBorder = utente.selectedBorder || "none";

    const media = document.getElementById("mediaProfilo");
    media.innerHTML = "";
    const display = CURRENT.avatarBaseUrl || "/frontend/img/default-avatar-icon-of-social-media-user-vector.jpg";
    if (display) {
      if (eVideo(display)) {
        media.innerHTML = `<video width="220" height="260" style="border-radius:50%;object-fit:cover" controls src="${display}"></video>`;
      } else {
        media.innerHTML = `<img src="${display}" alt="Immagine profilo" width="220" height="260" style="border-radius:50%;object-fit:cover"/>`;
      }
    }

    // --- Banner ---
    const banner = document.getElementById("bannerProfilo");
    banner.innerHTML = "";
    if (utente.bannerProfilo) {
      banner.innerHTML = `<img src="${utente.bannerProfilo}" alt="Banner" width="100%" style="max-height:200px; object-fit:cover"/>`;
    }

    // --- Decorazione selezionata ---
    const selBox = document.getElementById("selectedBorderBox");
    const selImg = document.getElementById("selectedBorderImg");
    const selUrl = getBorderUrl(CURRENT.selectedBorder);
    if (selUrl) { selImg.src = selUrl; selImg.alt = "Decorazione selezionata"; selBox.style.display = "block"; }
    else { selBox.style.display = "none"; }

    // Banner
    const banner1 = document.getElementById("bannerProfilo");
    banner1.innerHTML = "";
    if (data.utente.bannerProfilo) {
      banner1.innerHTML = `<img src="${window.safeDom.sanitizeText(data.utente.bannerProfilo)}" alt="Banner" width="100%" style="max-height:200px; object-fit:cover"/>`;
    }

    else {
      banner.innerHTML = `<img src="/frontend/img/default_banner.jpg" alt="Banner" width="100%" style="max-height:200px; object-fit:cover"/>`;
    }
    // Aggiorna il nome utente nel titolo dei post
    document.getElementById("postUsername").textContent = window.safeDom.sanitizeText(data.utente.username);

    // Generazione post di esempio (da sostituire con i veri post quando il backend sarà pronto)
    const postContainer = document.getElementById("postContainer");

    await setupBordersUI();

    // --- Fetch dei post dell’utente separatamente ---
    const userId = utente._id.$oid || utente._id;
const postsRes = await fetch(`http://localhost:8080/api/posts/utente/${userId}`);
if (!postsRes.ok) {
  console.error("Errore fetch post:", postsRes.status, postsRes.statusText);
  return;
}
const postsData = await postsRes.json();
const posts = postsData.success ? postsData.posts : [];


    const container = document.getElementById("postContainer");
    if (container) {
      container.innerHTML = "";
      if (!posts.length) {
        return;
      } else {
        posts.forEach(post => {
          const postElem = document.createElement("div");
          postElem.className = "post";
          postElem.innerHTML = `
            <h3>${post.titolo}</h3>
            <p>${post.descrizione}</p>
            ${post.ImmaginePost ? `<img src="${post.ImmaginePost}" width="200" height="150"/>` : ""}
            <small>Creato il: ${post.createdAt ? new Date(post.createdAt).toLocaleString() : "Data non disponibile"}</small>
          `;
          container.appendChild(postElem);
        });
      }
    }

  } catch (err) {
    console.error("caricaProfilo error:", err);
    showPopup({
      title: "Errore",
      text: "Errore caricamento profilo",
      duration: 1500
    });
  }
}

// Upload media profilo
document.getElementById("uploadForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const file = document.querySelector('#uploadForm input[name="file"]').files[0];
  if (!file || !token) return;
  const formData = new FormData(); formData.append("file", file);

  const res = await fetch("http://localhost:8080/api/upload", {
    method: "POST", headers: { Authorization: "Bearer " + token }, body: formData,
  });

  const data = await res.json();
  showPopup({
    title: data.success ? "Successo" : "Errore",
    text: window.safeDom.sanitizeText(data.message || (data.success ? "Upload completato" : "Errore upload")),
    duration: 1500
  });
  await caricaProfilo();
});

// Upload banner
document.getElementById("bannerForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const file = document.querySelector('#bannerForm input[name="file"]').files[0];
  if (!file || !token) return;
  const formData = new FormData(); formData.append("file", file);

  const res = await fetch("http://localhost:8080/api/upload/banner", {
    method: "POST", headers: { Authorization: "Bearer " + token }, body: formData
  });

  const data = await res.json();
  showPopup({
    title: data.success ? "Successo" : "Errore",
    text: window.safeDom.sanitizeText(data.message || (data.success ? "Banner caricato" : "Errore upload banner")),
    duration: 1500
  });
  await caricaProfilo();
});

// Modifica info base
document.getElementById("modificaForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const username = document.getElementById("usernameInput").value;
  const birthdate = document.getElementById("birthdateInput").value;

  const res = await fetch("http://localhost:8080/api/profilo/update", {
    method: "PUT",
    headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
    body: JSON.stringify({ username, birthdate })
  });

  const data = await res.json();
  showPopup({
    title: data.success ? "Successo" : "Errore",
    text: window.safeDom.sanitizeText(data.message || (data.success ? "Modifica completata" : "Errore modifica")),
    duration: 1500
  });
  await caricaProfilo();
});

// Trofei UI
async function setupBordersUI() {
  try {
    const res = await fetch("http://localhost:8080/api/trophy", {
      headers: { Authorization: "Bearer " + token }
    });
    const data = await res.json();
    if (!data.success) return;

    CURRENT.unlocked = data.unlockedBorders || [];
    const selectedKey = keyFromAny(CURRENT.selectedBorder);

    document.querySelectorAll(".pfp-border").forEach(img => {
      const key = img.dataset.border;
      img.classList.remove("locked", "selected");
      img.onclick = null;

      const isUnlocked = CURRENT.unlocked.includes(key);
      if (!isUnlocked) { img.classList.add("locked"); return; }

      img.onclick = () => handleBorderClick(key);
      if (key === selectedKey) img.classList.add("selected");
    });
  } catch (err) { console.error("setupBordersUI error:", err); }
}

async function handleBorderClick(key) {
  const url = getBorderUrl(key);
  const selRes = await fetch("http://localhost:8080/api/trophy/select", {
    method: "PUT",
    headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
    body: JSON.stringify({ borderKey: key, borderUrl: url })
  });
  const selData = await resJsonSafe(selRes);
  if (!selData.success) {
    showPopup({
      title: "Errore",
      text: window.safeDom.sanitizeText(selData.message || "Impossibile selezionare la cornice"),
      duration: 1500
    });
    return;
  }

  CURRENT.selectedBorder = url || "none";
  document.querySelectorAll(".pfp-border").forEach(i => i.classList.remove("selected"));
  const el = document.querySelector(`.pfp-border[data-border="${key}"]`);
  if (el) el.classList.add("selected");

  const selBox = document.getElementById("selectedBorderBox");
  const selImg = document.getElementById("selectedBorderImg");
  if (url) { selImg.src = url; selBox.style.display = "block"; }
  else { selBox.style.display = "none"; }

  showPopup({
    title: "Successo",
    text: "Cornice selezionata!",
    duration: 1200
  });
}

// ======= BOX CENTRALE (MODALE) LISTA UTENTI =======
const usersModal = document.getElementById("modalUsers");
const usersTitle = document.getElementById("modalUsersTitle");
const userListContainer = document.getElementById("userListContainer");

function closeUsersModal() { usersModal.style.display = "none"; userListContainer.innerHTML = ""; }
usersModal.addEventListener("click", (e) => { if (e.target.id === "modalUsers") closeUsersModal(); });

async function getUserById(id){
  try {
    const res = await fetch(`http://localhost:8080/api/utente/${id}`);
    const data = await res.json();
    if (data && data.success) return { _id: id, ...data.utente };
  } catch (e) { console.error("getUserById error:", e); }
  return null;
}

async function openUserList(kind){
  const ids = (kind === "follower") ? CURRENT.followerIds : CURRENT.seguitiIds;
  usersTitle.textContent = (kind === "follower") ? "Follower" : "Seguiti";
  usersModal.style.display = "flex";
  userListContainer.innerHTML = `<div class="userlist-row-skeleton">Caricamento...</div>`;

  if (!ids || !ids.length) {
    userListContainer.innerHTML = `<div class="userlist-row-skeleton">Nessun utente</div>`;
    return;
  }

  const results = await Promise.all(ids.map(getUserById));
  const users = results.filter(Boolean);

  userListContainer.innerHTML = users.map(u => `
    <div class="userlist-item" data-id="${u._id}">
      <img class="avatar" src="${u.immagineProfilo || "/frontend/assets/logo.png"}" alt="">
      <div>
        <div class="name">${u.username}</div>
        <div class="points">Punti: ${u.punti || 0}</div>
      </div>
    </div>
  `).join("");

  userListContainer.querySelectorAll(".userlist-item").forEach(r => {
    r.addEventListener("click", () => {
      const id = r.getAttribute("data-id");
      localStorage.setItem("utenteVisualizzato", id);
      window.location.href = "/frontend/html/ProEsterno.html";
    });
  });
}

// ====== Avvio caricamento al DOM ready ======
document.addEventListener("DOMContentLoaded", () => {
  caricaProfilo();
});
