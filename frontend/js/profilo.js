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

async function resJsonSafe(res) { try { return await res.json(); } catch { return { success:false, message:"Errore JSON" }; } }
function isHttpUrl(v) { return typeof v === "string" && /^https?:\/\//i.test(v); }

function keyFromBorderUrl(url) {
  if (!url || url === "none") return "none";
  try {
    const path = new URL(url).pathname;
    const fname = path.split("/").pop() || "";
    const base  = fname.split(".")[0] || "";
    let tail = base.replace(/^border-/i, "");
    tail = tail.replace(/^[-_]+/, "");
    const pure = tail.split("_")[0];
    return (pure || "none").toLowerCase();
  } catch {
    const m = String(url).match(/(?:^|\/)border-([-_]*)([a-z0-9]+)(?:[_.].+)?\.(?:png|jpg|jpeg|webp)$/i);
    return m ? m[2].toLowerCase() : "none";
  }
}
function getBorderUrl(v) { if (!v) return ""; if (isHttpUrl(v)) return v; return BORDER_URLS[String(v).toLowerCase()] || ""; }
function keyFromAny(v) { if (!v) return "none"; return isHttpUrl(v) ? keyFromBorderUrl(v) : String(v).toLowerCase(); }

let CURRENT = {
  avatarBaseUrl: "",
  unlocked: [],
  selectedBorder: "none",
  followerIds: [],
  seguitiIds: []
};

async function caricaProfilo() {
  if (!token) { document.body.innerHTML = "<p>Token mancante. Esegui il login.</p>"; return; }

  try {
    const res = await fetch("http://localhost:8080/api/profilo", {
      headers: { Authorization: "Bearer " + token }
    });
    const data = await res.json();
    if (!data.success) {
      document.body.innerHTML = "<p>Accesso negato: " + (data.message || "Errore") + "</p>";
      return;
    }

    // Info base
    document.getElementById("usernameDisplay").textContent = data.utente.username;
    document.getElementById("emailDisplay").textContent    = data.utente.email;
    document.getElementById("birthdateDisplay").textContent= safeBirthdateStr(data.utente.birthdate);
    document.getElementById("puntiDisplay").textContent    = data.utente.punti;

    // Contatori + ids
    CURRENT.followerIds = Array.isArray(data.utente.follower) ? data.utente.follower : [];
    CURRENT.seguitiIds  = Array.isArray(data.utente.seguiti)  ? data.utente.seguiti  : [];
    document.getElementById("countFollower").textContent = CURRENT.followerIds.length;
    document.getElementById("countSeguiti").textContent  = CURRENT.seguitiIds.length;

    // Click per aprire box centrale
    document.getElementById("openFollower").onclick = () => openUserList("follower");
    document.getElementById("openSeguiti").onclick  = () => openUserList("seguiti");

    // Modale inputs
    document.getElementById("usernameInput").value  = data.utente.username;
    document.getElementById("birthdateInput").value = safeBirthdateStr(data.utente.birthdate);

    // Media profilo
    CURRENT.avatarBaseUrl  = data.utente.immagineProfilo || "";
    CURRENT.selectedBorder = data.utente.selectedBorder || "none";

    const media = document.getElementById("mediaProfilo");
    media.innerHTML = "";
    const display = CURRENT.avatarBaseUrl;
    if (display) {
      if (eVideo(display)) {
        media.innerHTML = `<video width="220" height="260" style="border-radius:50%;object-fit:cover" controls src="${display}"></video>`;
      } else {
        media.innerHTML = `<img src="${display}" alt="Immagine profilo" width="220" height="260" style="border-radius:50%;object-fit:cover"/>`;
      }
    }

    // Cornice selezionata
    const selBox = document.getElementById("selectedBorderBox");
    const selImg = document.getElementById("selectedBorderImg");
    const selUrl = getBorderUrl(CURRENT.selectedBorder);
    if (selUrl) { selImg.src = selUrl; selImg.alt = "Cornice selezionata"; selBox.style.display = "block"; }
    else { selBox.style.display = "none"; }

    // Banner
    const banner = document.getElementById("bannerProfilo");
    banner.innerHTML = "";
    if (data.utente.bannerProfilo) {
      banner.innerHTML = `<img src="${data.utente.bannerProfilo}" alt="Banner" width="100%" style="max-height:200px; object-fit:cover"/>`;
    }

    await setupBordersUI();
  } catch (err) {
    console.error("caricaProfilo error:", err);
  }
}

//post utente

async function caricaPostUtente() {
  if (!token) {
    document.body.innerHTML = "<p>Token mancante. Esegui il login.</p>";
    return;
  }

  try {
    const res = await fetch("http://localhost:8080/api/post", {
      headers: {
        Authorization: "Bearer " + token,
        "Content-Type": "application/json"
      }
    });

    if (!res.ok) throw new Error("Errore nel caricamento dei post");

    const posts = await res.json();

    const container = document.getElementById("postContainer");
    container.innerHTML = "";

    posts.forEach(post => {
      const postElem = document.createElement("div");
      postElem.className = "post";

      postElem.innerHTML = `
        <h3>${post.titolo}</h3>
        <p>${post.descrizione}</p>
        <p>Autore: ${post.autoreNome}</p>
        ${post.autoreImmagine ? `<img src="${post.autoreImmagine}" width="50" height="50"/>` : ""}
        ${post.ImmaginePost ? `<img src="${post.ImmaginePost}" width="200" height="150"/>` : ""}
        <small>Creato il: ${post.createdAt || "Data non disponibile"}</small>
      `;

      container.appendChild(postElem);
    });

  } catch (err) {
    console.error("Errore in caricaPostUtente:", err);
    document.body.innerHTML += `<p>Errore nel caricamento dei post</p>`;
  }
}


caricaPostUtente(CURRENT.userId);



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
  const msgEl = document.getElementById("messaggio");
  if (msgEl) msgEl.innerText = data.message || "Upload completato";
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
  const msgEl = document.getElementById("messaggio");
  if (msgEl) msgEl.innerText = data.message || "Banner caricato";
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
  alert(data.message || "Modifica completata");
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
  if (!selData.success) { alert(selData.message || "Impossibile selezionare la cornice"); return; }

  CURRENT.selectedBorder = url || "none";
  document.querySelectorAll(".pfp-border").forEach(i => i.classList.remove("selected"));
  const el = document.querySelector(`.pfp-border[data-border="${key}"]`);
  if (el) el.classList.add("selected");

  const selBox = document.getElementById("selectedBorderBox");
  const selImg = document.getElementById("selectedBorderImg");
  if (url) { selImg.src = url; selBox.style.display = "block"; }
  else { selBox.style.display = "none"; }

  const msgEl = document.getElementById("messaggio");
  if (msgEl) msgEl.innerText = "Cornice selezionata!";
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

caricaProfilo();

