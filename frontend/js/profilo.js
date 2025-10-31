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
    CURRENT.avatarBaseUrl  = utente.immagineProfilo || "";
    CURRENT.selectedBorder = utente.selectedBorder || "none";

  const media = document.getElementById("mediaProfilo");
  while (media.firstChild) media.removeChild(media.firstChild);
    const display = CURRENT.avatarBaseUrl || "/frontend/img/default-avatar-icon-of-social-media-user-vector.jpg";
    if (display) {
      if (eVideo(display)) {
        const video = document.createElement('video');
        video.width = 220; video.height = 260; video.controls = true;
        video.style.borderRadius = '50%'; video.style.objectFit = 'cover';
        // only set src if it looks like an http(s) URL or a safe local path
        if (/^https?:\/\//i.test(display) || display.startsWith('/')) video.src = display;
        media.appendChild(video);
      } else {
        const img = document.createElement('img');
        img.width = 220; img.height = 260; img.alt = 'Immagine profilo';
        img.style.borderRadius = '50%'; img.style.objectFit = 'cover';
        if (/^https?:\/\//i.test(display) || display.startsWith('/')) img.src = display;
        media.appendChild(img);
      }
    }

    // --- Banner ---
  const banner = document.getElementById("bannerProfilo");
  while (banner.firstChild) banner.removeChild(banner.firstChild);
    if (utente.bannerProfilo && (/^https?:\/\//i.test(utente.bannerProfilo) || utente.bannerProfilo.startsWith('/'))) {
      const bimg = document.createElement('img');
      bimg.src = utente.bannerProfilo;
      bimg.alt = 'Banner'; bimg.style.maxHeight = '200px'; bimg.style.objectFit = 'cover'; bimg.style.width = '100%';
      banner.appendChild(bimg);
    }

    // --- Decorazione selezionata ---
    const selBox = document.getElementById("selectedBorderBox");
    const selImg = document.getElementById("selectedBorderImg");
    const selUrl = getBorderUrl(CURRENT.selectedBorder);
    if (selUrl) { selImg.src = selUrl; selImg.alt = "Decorazione selezionata"; selBox.style.display = "block"; }
    else { selBox.style.display = "none"; }

    // Banner
  const banner1 = document.getElementById("bannerProfilo");
  while (banner1.firstChild) banner1.removeChild(banner1.firstChild);
    if (data.utente.bannerProfilo && (/^https?:\/\//i.test(data.utente.bannerProfilo) || data.utente.bannerProfilo.startsWith('/'))) {
      const bimg = document.createElement('img');
      bimg.src = data.utente.bannerProfilo;
      bimg.alt = 'Banner'; bimg.style.maxHeight = '200px'; bimg.style.objectFit = 'cover'; bimg.style.width = '100%';
      banner1.appendChild(bimg);
    }

    // Aggiorna il nome utente nel titolo dei post
    document.getElementById("postUsername").textContent = window.safeDom.sanitizeText(data.utente.username);

    // Container principale per i post
    const postContainer = document.getElementById("postContainer");
    if (!postContainer) return;
  while (postContainer.firstChild) postContainer.removeChild(postContainer.firstChild);

    // Funzione che costruisce e inserisce un singolo post usando DOM (sicuro)
    function renderPost(post, author) {
      const article = document.createElement('article');
      article.className = 'post-card';

      // Header
      const header = document.createElement('header'); header.className = 'post-header';
      const avatar = document.createElement('img');
      avatar.src = author.immagineProfilo || '../assets/default-pfp.jpg';
      avatar.alt = window.safeDom.sanitizeText(author.username || '');
      const authorInfo = document.createElement('div'); authorInfo.className = 'post-author-info';
      const authorName = document.createElement('div'); authorName.className = 'post-author-name'; authorName.textContent = window.safeDom.sanitizeText(author.username || '');
      const timeEl = document.createElement('time'); timeEl.className = 'post-date'; timeEl.textContent = post.createdAt ? new Date(post.createdAt).toLocaleDateString('it-IT') : '';
      authorInfo.append(authorName, timeEl);
      header.append(avatar, authorInfo);
      article.appendChild(header);

      // Image (se presente)
      if (post.ImmaginePost) {
        const imgWrap = document.createElement('div'); imgWrap.className = 'post-image-container';
        const pimg = document.createElement('img'); pimg.className = 'post-image'; pimg.src = post.ImmaginePost; pimg.alt = window.safeDom.sanitizeText(post.titolo || '');
        imgWrap.appendChild(pimg);
        article.appendChild(imgWrap);
      }

      // Details
      const details = document.createElement('div'); details.className = 'post-details';
      const title = document.createElement('h3'); title.className = 'post-title'; title.textContent = window.safeDom.sanitizeText(post.titolo || '');
      const txt = document.createElement('p'); txt.className = 'post-text'; txt.textContent = window.safeDom.sanitizeText(post.descrizione || '');
      details.append(title, txt);
      article.appendChild(details);

      // Footer / Actions
      const footer = document.createElement('footer'); footer.className = 'post-footer';
      const actions = document.createElement('div'); actions.className = 'post-actions';
      const likeBtn = document.createElement('button'); likeBtn.className = 'like-button';
      likeBtn.dataset.postId = post._id && post._id.$oid ? post._id.$oid : (post._id || '');
  const star = document.createElement('span'); star.className = 'like-icon';
  // create SVG star icon via DOM (safer)
  const svgNS = 'http://www.w3.org/2000/svg';
  const svgEl = document.createElementNS(svgNS, 'svg');
  svgEl.setAttribute('aria-hidden', 'true');
  svgEl.setAttribute('width', '18');
  svgEl.setAttribute('height', '18');
  svgEl.setAttribute('viewBox', '0 0 24 24');
  svgEl.setAttribute('fill', 'currentColor');
  const path = document.createElementNS(svgNS, 'path');
  path.setAttribute('d', 'M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z');
  svgEl.appendChild(path);
  star.appendChild(svgEl);
      const count = document.createElement('span'); count.className = 'like-count'; count.textContent = post.likes || 0;
      likeBtn.append(star, count);
      actions.appendChild(likeBtn);
      footer.appendChild(actions);
      article.appendChild(footer);

      // Like listener (UI + chiamata API)
      likeBtn.addEventListener('click', async function () {
        try {
          const postId = this.dataset.postId;
          if (!postId) return;
          const res = await fetch(`http://localhost:8080/api/posts/${postId}/like`, {
            method: 'POST', headers: { Authorization: 'Bearer ' + token }
          });
          const rjson = await resJsonSafe(res);
          if (rjson && rjson.success) {
            this.classList.toggle('liked');
            const c = this.querySelector('.like-count');
            const n = parseInt(c.textContent) || 0;
            c.textContent = this.classList.contains('liked') ? n + 1 : Math.max(0, n - 1);
            // micro-interaction: pop animation
            this.classList.add('pop');
            setTimeout(() => this.classList.remove('pop'), 420);
          } else {
            showPopup({ title: 'Errore', text: window.safeDom.sanitizeText(rjson.message || 'Impossibile aggiornare il like') });
          }
        } catch (e) {
          console.error('like error', e);
          showPopup({ title: 'Errore', text: 'Impossibile aggiornare il like' });
        }
      });

      postContainer.appendChild(article);
    }

    // Esempi fallback (sviluppo) - saranno usati se il fetch reale fallisce o non ritorna post
    const examplePosts = [
      {
        titolo: 'Scoperta di una nuova galassia! 🌌',
        descrizione: "Ho appena scoperto una nuova galassia! Le stelle qui brillano di una luce mai vista prima.",
        ImmaginePost: '../assets/nebula1.jpg',
        createdAt: '2025-10-28',
        likes: 15
      },
      {
        titolo: 'Nebulosa arcobaleno ✨',
        descrizione: 'Una meravigliosa nebulosa si staglia all\'orizzonte. I colori sono incredibili!',
        ImmaginePost: '../assets/planet2.jpg',
        createdAt: '2025-10-27',
        likes: 23
      }
    ];

    // Prima carichiamo l'interfaccia dei trofei (può cambiare classi selezionate)
    await setupBordersUI();

    // Fetch dei post reali; se fallisce o non ne trova, uso fallback examplePosts
    try {
      const userId = utente._id && utente._id.$oid ? utente._id.$oid : (utente._id || '');
      const postsRes = await fetch(`http://localhost:8080/api/posts/utente/${userId}`, { headers: { Authorization: 'Bearer ' + token } });
      if (!postsRes.ok) throw new Error('fetch posts failed');
      const postsData = await postsRes.json();
      const posts = postsData && postsData.success ? postsData.posts : [];
      if (!posts || !posts.length) {
        // fallback
        examplePosts.forEach(p => renderPost(p, data.utente));
      } else {
        posts.forEach(p => renderPost(p, data.utente));
      }
    } catch (e) {
      console.warn('Caricamento post reali fallito, uso fallback examplePosts', e);
      examplePosts.forEach(p => renderPost(p, data.utente));
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

function closeUsersModal() { usersModal.style.display = "none"; while (userListContainer.firstChild) userListContainer.removeChild(userListContainer.firstChild); }
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
  // show skeleton via DOM
  while (userListContainer.firstChild) userListContainer.removeChild(userListContainer.firstChild);
  const skeleton = document.createElement('div'); skeleton.className = 'userlist-row-skeleton'; skeleton.textContent = 'Caricamento...';
  userListContainer.appendChild(skeleton);

  if (!ids || !ids.length) {
  while (userListContainer.firstChild) userListContainer.removeChild(userListContainer.firstChild);
  const noneEl = document.createElement('div'); noneEl.className = 'userlist-row-skeleton'; noneEl.textContent = 'Nessun utente';
  userListContainer.appendChild(noneEl);
    return;
  }

  const results = await Promise.all(ids.map(getUserById));
  const users = results.filter(Boolean);

  while (userListContainer.firstChild) userListContainer.removeChild(userListContainer.firstChild);
  users.forEach(u => {
    const item = document.createElement('div');
    item.className = 'userlist-item';
    item.dataset.id = u._id || '';

    const avatar = document.createElement('img');
    avatar.className = 'avatar';
    avatar.src = (u.immagineProfilo && (/^https?:\/\//i.test(u.immagineProfilo) || u.immagineProfilo.startsWith('/'))) ? u.immagineProfilo : '/frontend/assets/logo.png';
    avatar.alt = '';

    const info = document.createElement('div');
    const name = document.createElement('div'); name.className = 'name';
    name.textContent = (window.safeDom && window.safeDom.sanitizeText) ? window.safeDom.sanitizeText(u.username || '') : (u.username || '');
    const pts = document.createElement('div'); pts.className = 'points';
    pts.textContent = 'Punti: ' + (u.punti || 0);

    info.appendChild(name); info.appendChild(pts);
    item.appendChild(avatar); item.appendChild(info);

    item.addEventListener('click', () => {
      const id = item.getAttribute('data-id');
      localStorage.setItem('utenteVisualizzato', id);
      window.location.href = '/frontend/html/ProEsterno.html';
    });

    userListContainer.appendChild(item);
  });
}

// ====== Avvio caricamento al DOM ready ======
document.addEventListener("DOMContentLoaded", () => {
  caricaProfilo();
});
