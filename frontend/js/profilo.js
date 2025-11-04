/* profilo.js (versione corretta) */
const token = localStorage.getItem("token");

const BORDER_URLS = Object.freeze({
  bronzo: "https://res.cloudinary.com/dprigpdai/image/upload/v1755211493/trophy-bronzo_xl2hkq.png",
  argento: "https://res.cloudinary.com/dprigpdai/image/upload/v1755211494/trophy-argento_lckpvi.png",
  oro: "https://res.cloudinary.com/dprigpdai/image/upload/v1755211491/trophy-oro_lrt8tr.png",
  platino: "https://res.cloudinary.com/dprigpdai/image/upload/v1755211490/trophy-platino_k95tal.png",
  rubino: "https://res.cloudinary.com/dprigpdai/image/upload/v1755211490/trophy-rubino_odsmnm.png",
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
  try {
    return await res.json();
  } catch {
    return { success: false, message: "Errore JSON" };
  }
}

function isHttpUrl(v) {
  return typeof v === "string" && /^https?:\/\//i.test(v);
}
function getBorderUrl(v) {
  if (!v) return "";
  if (isHttpUrl(v)) return v;
  return BORDER_URLS[String(v).toLowerCase()] || "";
}
function keyFromAny(v) {
  if (!v) return "none";
  return isHttpUrl(v) ? "none" : String(v).toLowerCase();
}

let CURRENT = {
  avatarBaseUrl: "",
  unlocked: [],
  selectedBorder: "none",
  followerIds: [],
  seguitiIds: [],
};

function showPopup({ title, text, duration = 1000 }) {
  const overlay = window.safeDom.createSafeElement("div", { className: "welcome-overlay" });
  const popupDiv = window.safeDom.createSafeElement("div", { className: "welcome-popup" });
  const logo = window.safeDom.createSafeElement("img", {
    className: "welcome-logo",
    src: "/frontend/assets/logo.png",
  });
  logo.alt = "Logo";
  const titleElement = window.safeDom.createSafeElement("h2", {}, title);
  const textElement = window.safeDom.createSafeElement("p", {}, text);
  const loadingBar = window.safeDom.createSafeElement("div", { className: "loading-bar" });
  const loadingFill = window.safeDom.createSafeElement("div", { className: "loading-fill" });
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

/* ====== caricaProfilo ====== */
async function caricaProfilo() {
  if (!token) {
    showPopup({
      title: "Errore",
      text: "Token mancante. Esegui il login.",
      duration: 1500,
    });
    return;
  }

  try {
    const res = await fetch("http://localhost:8080/api/profilo", {
      headers: { Authorization: "Bearer " + token },
    });
    const data = await res.json();
    if (!data.success) {
      showPopup({
        title: "Errore",
        text: window.safeDom.sanitizeText(data.message || "Accesso negato"),
        duration: 1500,
      });
      return;
    }

    const utente = data.utente;

    // Info base
    const byId = id => document.getElementById(id);
    byId("usernameDisplay").textContent = utente.username || "";
    byId("emailDisplay").textContent = utente.email || "";
    byId("birthdateDisplay").textContent = safeBirthdateStr(utente.birthdate);
    byId("puntiDisplay").textContent = utente.punti ?? "";
    byId("navUsername").textContent = utente.username || "";

    // follower / seguiti ids + conteggi
    CURRENT.followerIds = Array.isArray(utente.follower) ? utente.follower.map(f => f.$oid || f) : [];
    CURRENT.seguitiIds = Array.isArray(utente.seguiti) ? utente.seguiti.map(s => s.$oid || s) : [];
    const countFollowerEl = byId("countFollower");
    const countSeguitiEl = byId("countSeguiti");
    if (countFollowerEl) countFollowerEl.textContent = CURRENT.followerIds.length;
    if (countSeguitiEl)  countSeguitiEl.textContent  = CURRENT.seguitiIds.length;

    // assegna onclick direttamente (ridondanza rispetto alla delegazione globale)
    const elFollower = byId("openFollower");
    const elSeguiti  = byId("openSeguiti");
    if (elFollower) elFollower.onclick = () => openUserList("follower");
    if (elSeguiti)  elSeguiti.onclick  = () => openUserList("seguiti");

    // modale inputs
    if (byId("usernameInput")) byId("usernameInput").value = utente.username || "";
    if (byId("birthdateInput")) byId("birthdateInput").value = safeBirthdateStr(utente.birthdate);

    // media profilo
    CURRENT.avatarBaseUrl = utente.immagineProfilo || "/frontend/img/default-avatar-icon-of-social-media-user-vector.jpg";
    CURRENT.selectedBorder = utente.selectedBorder || "none";

    const media = byId("mediaProfilo");
    if (media) {
      media.innerHTML = "";
      const display = CURRENT.avatarBaseUrl;
      if (display) {
        if (eVideo(display)) {
          media.innerHTML = `<video width="220" height="260" style="border-radius:50%;object-fit:cover" controls src="${display}"></video>`;
        } else {
          media.innerHTML = `<img src="${display}" alt="Immagine profilo" width="220" height="260" style="border-radius:50%;object-fit:cover"/>`;
        }
      }
    }

    // banner
    const banner = byId("bannerProfilo");
    if (banner) {
      banner.innerHTML = `<img src="${utente.bannerProfilo || '/frontend/img/default_banner.jpg'}" alt="Banner" width="100%" style="max-height:200px; object-fit:cover"/>`;
    }

    // decorazione selezionata box
    const selBox = byId("selectedBorderBox");
    const selImg = byId("selectedBorderImg");
    const selUrl = getBorderUrl(CURRENT.selectedBorder);
    if (selBox && selImg) {
      if (selUrl) {
        selImg.src = selUrl;
        selImg.alt = "Decorazione selezionata";
        selBox.style.display = "block";
      } else selBox.style.display = "none";
    }

    // titoli post
    if (byId("postUsername")) byId("postUsername").textContent = window.safeDom.sanitizeText(utente.username || "");

    // === POST ===
    const userId = utente._id?.$oid || utente._id;
    const postsRes = await fetch(`http://localhost:8080/api/posts/utente/${userId}`);
    const postsData = await postsRes.json();
    const posts = postsData.success ? postsData.posts : [];

    const container = byId("postContainer");
    if (container) {
      container.innerHTML = "";
      if (!posts || !posts.length) {
        container.innerHTML = `<div class="no-posts">Nessun post disponibile</div>`;
      } else {
        posts.forEach(post => {
          const postElem = document.createElement("div");
          postElem.className = "post-card";
          postElem.innerHTML = `
            <div class="post-header">
              <h3 class="post-title">${post.titolo || ''}</h3>
            </div>
            <div class="post-body">
              <p class="post-text">${post.descrizione || ''}</p>
              ${post.ImmaginePost ? `<img class="post-image" src="${post.ImmaginePost}" alt="Post image">` : ""}
            </div>
            <div class="post-footer">
              <div class="post-date">Creato il: ${post.createdAt ? new Date(post.createdAt).toLocaleString() : "Data non disponibile"}</div>
            </div>
          `;
          // click per overlay (solo se immagine o dati esistono)
          postElem.addEventListener("click", () => openPostOverlay(post));
          container.appendChild(postElem);
        });
      }
    }

    await setupBordersUI();
  } catch (err) {
    console.error("caricaProfilo error:", err);
    showPopup({ title: "Errore", text: "Errore caricamento profilo", duration: 1500 });
  }
}

/* ====== setupBordersUI (tua implementazione) ====== */
async function setupBordersUI() {
  const bordiGrid = document.getElementById("bordiGrid");
  const selectedBox = document.getElementById("selectedBorderBox");
  const selectedImg = document.getElementById("selectedBorderImg");

  if (!bordiGrid) return;

  const savedBorder = localStorage.getItem("selectedBorder");
  if (savedBorder) {
    const imgEl = bordiGrid.querySelector(`[data-border="${savedBorder}"]`);
    if (imgEl) mostraBordoSelezionato(imgEl.src, savedBorder);
  }

  bordiGrid.querySelectorAll(".pfp-border").forEach((img) => {
    img.addEventListener("click", () => {
      const tipo = img.getAttribute("data-border");
      const src = img.getAttribute("src");
      mostraBordoSelezionato(src, tipo);
      localStorage.setItem("selectedBorder", tipo);
      bordiGrid.querySelectorAll(".bordo-card").forEach(card => card.classList.remove("selected"));
      img.closest(".bordo-card").classList.add("selected");
    });
  });

  function mostraBordoSelezionato(src, nome) {
    if (selectedBox && selectedImg) {
      selectedBox.style.display = "block";
      selectedImg.src = src;
      selectedImg.alt = nome;
    }
  }
}

/* ====== Funzioni per MODALE follower/seguiti (mancavano) ====== */
const usersModal = document.getElementById("modalUsers");
const usersTitle = document.getElementById("modalUsersTitle");
const userListContainer = document.getElementById("userListContainer");

function closeUsersModal() {
  if (usersModal) usersModal.style.display = "none";
  if (userListContainer) userListContainer.innerHTML = "";
}
if (usersModal) {
  usersModal.addEventListener("click", (e) => {
    if (e.target === usersModal) closeUsersModal();
  });
}

async function getUserById(id) {
  if (!id) return null;
  try {
    const res = await fetch(`http://localhost:8080/api/utente/${id}`);
    const data = await res.json();
    if (data && data.success) return { _id: id, ...data.utente };
  } catch (e) {
    console.error("getUserById error:", e);
  }
  return null;
}

async function openUserList(tipo) {
  // Rimuovi duplicati usando Set
  const ids = [...new Set(tipo === "follower" ? CURRENT.followerIds : CURRENT.seguitiIds)];
  const container = document.getElementById("userListContainer");
  container.innerHTML = "";

  for (const id of ids) {
    try {
      const res = await fetch(`http://localhost:8080/api/utente/${id}`);
      const data = await res.json();
      if (!data.success) continue;

      const utente = data.utente;

      const barra = document.createElement("div");
      barra.className = "user-bar";
      barra.style.display = "flex";
      barra.style.alignItems = "center";
      barra.style.marginBottom = "8px";

      barra.innerHTML = `
        <img src="${utente.immagineProfilo || '/frontend/img/default-avatar-icon-of-social-media-user-vector.jpg'}" 
             alt="Avatar" style="width:36px;height:36px;border-radius:50%;margin-right:8px;">
        <div>
          <div>${utente.username}</div>
          <div style="font-size:.8rem;opacity:.7;">Punti: ${utente.punti}</div>
        </div>
      `;

      container.appendChild(barra);
    } catch (err) {
      console.error("Errore caricamento utente:", err);
    }
  }

  const modal = document.getElementById("modalUsers");
  if (modal) modal.style.display = "flex";
}

/* ====== Overlay Zoom Post ====== */
function openPostOverlay(post) {
  const overlay = document.getElementById("postOverlay");
  const overlayImg = document.getElementById("overlayImage");
  const overlayTitle = document.getElementById("overlayTitle");
  const overlayText = document.getElementById("overlayText");
  const overlayDate = document.getElementById("overlayDate");
  const closeBtn = document.getElementById("closePostOverlay");

  if (!overlay) return;

  if (overlayImg) overlayImg.src = post.ImmaginePost || "";
  if (overlayTitle) overlayTitle.textContent = post.titolo || "Senza titolo";
  if (overlayText) overlayText.textContent = post.descrizione || "";
  if (overlayDate) overlayDate.textContent = post.createdAt ? `Pubblicato il ${new Date(post.createdAt).toLocaleString()}` : "Data non disponibile";

  overlay.style.display = "flex";

  if (closeBtn) closeBtn.onclick = () => closePostOverlay();
  overlay.onclick = (e) => {
    if (e.target && e.target.id === "postOverlay") closePostOverlay();
  };
}

function closePostOverlay() {
  const overlay = document.getElementById("postOverlay");
  if (overlay) overlay.style.display = "none";
}

/* ====== Upload immagine profilo (invariato) ====== */
const uploadForm = document.getElementById("uploadForm");
if (uploadForm) {
  uploadForm.addEventListener("submit", async e => {
    e.preventDefault();
    const file = document.querySelector('#uploadForm input[name="file"]').files[0];
    if (!file || !token) return;
    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch("http://localhost:8080/api/upload", {
      method: "POST",
      headers: { Authorization: "Bearer " + token },
      body: formData,
    });

    const data = await res.json();
    showPopup({
      title: data.success ? "Successo" : "Errore",
      text: window.safeDom.sanitizeText(data.message || (data.success ? "Upload completato" : "Errore upload")),
      duration: 1500,
    });
    await caricaProfilo();
  });
}

/* ====== Avvio ====== */
document.addEventListener("DOMContentLoaded", () => {
  caricaProfilo();
});
