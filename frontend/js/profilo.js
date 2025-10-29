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

let CURRENT = {
  avatarBaseUrl: "",
  unlocked: [],
  selectedBorder: "none",
  followerIds: [],
  seguitiIds: []
};

// Funzioni ausiliarie
function eVideo(url) {
  if (!url || typeof url !== "string") return false;
  try {
    const u = new URL(url, window.location.origin);
    return /\.(mp4|webm|mov)$/i.test(u.pathname);
  } catch {
    return /\.(mp4|webm|mov)$/i.test(url);
  }
}

function safeText(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
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

function getBorderUrl(v) {
  if (!v) return "";
  if (/^https?:\/\//i.test(v)) return v;
  return BORDER_URLS[String(v).toLowerCase()] || "";
}

// --- Popup sicuro ---
function showPopup({ title, text, duration = 1500 }) {
  const overlay = document.createElement("div");
  overlay.className = "welcome-overlay";

  const popup = document.createElement("div");
  popup.className = "welcome-popup";

  const logo = document.createElement("img");
  logo.className = "welcome-logo";
  logo.src = "/frontend/assets/logo.png";
  logo.alt = "Logo";

  const titleElem = document.createElement("h2");
  titleElem.innerHTML = safeText(title);

  const textElem = document.createElement("p");
  textElem.innerHTML = safeText(text);

  const loadingBar = document.createElement("div");
  loadingBar.className = "loading-bar";
  const loadingFill = document.createElement("div");
  loadingFill.className = "loading-fill";
  loadingBar.appendChild(loadingFill);

  popup.append(logo, titleElem, textElem, loadingBar);
  overlay.appendChild(popup);
  document.body.appendChild(overlay);

  setTimeout(() => {
    overlay.style.opacity = "0";
    overlay.style.transition = "opacity 0.5s ease";
    setTimeout(() => overlay.remove(), 600);
  }, duration);
}

// --- Caricamento profilo ---
async function caricaProfilo() {
  if (!token) {
    showPopup({ title: "Errore", text: "Token mancante. Esegui il login." });
    return;
  }

  try {
    const res = await fetch("http://localhost:8080/api/profilo", {
      headers: { Authorization: "Bearer " + token }
    });
    const data = await res.json();
    if (!data.success) {
      showPopup({ title: "Errore", text: safeText(data.message || "Accesso negato") });
      return;
    }

    const utente = data.utente;
    document.getElementById("navUsername").textContent = utente.username;
    document.getElementById("usernameDisplay").textContent = utente.username;
    document.getElementById("emailDisplay").textContent = utente.email;
    document.getElementById("birthdateDisplay").textContent = safeBirthdateStr(utente.birthdate);
    document.getElementById("puntiDisplay").textContent = utente.punti;

    CURRENT.followerIds = Array.isArray(utente.follower) ? utente.follower.map(f => f.$oid || f) : [];
    CURRENT.seguitiIds  = Array.isArray(utente.seguiti)  ? utente.seguiti.map(s => s.$oid || s) : [];
    document.getElementById("countFollower").textContent = CURRENT.followerIds.length;
    document.getElementById("countSeguiti").textContent = CURRENT.seguitiIds.length;

    document.getElementById("openFollower").onclick = () => openUserList("follower");
    document.getElementById("openSeguiti").onclick = () => openUserList("seguiti");

    // Media profilo
    CURRENT.avatarBaseUrl  = utente.immagineProfilo || "";
    CURRENT.selectedBorder = utente.selectedBorder || "none";
    const media = document.getElementById("mediaProfilo");
    media.innerHTML = "";
    const display = CURRENT.avatarBaseUrl || "/frontend/img/default-avatar-icon-of-social-media-user-vector.jpg";
    if (display) {
      if (eVideo(display)) media.innerHTML = `<video src="${display}" controls></video>`;
      else media.innerHTML = `<img src="${display}" alt="Immagine profilo"/>`;
    }

    // Banner
    const banner = document.getElementById("bannerProfilo");
    banner.innerHTML = "";
    if (utente.bannerProfilo) {
      banner.innerHTML = `<img src="${utente.bannerProfilo}" alt="Banner"/>`;
    }

    // Cornice selezionata
    const selBox = document.getElementById("selectedBorderBox");
    const selImg = document.getElementById("selectedBorderImg");
    const selUrl = getBorderUrl(CURRENT.selectedBorder);
    if (selUrl) { selImg.src = selUrl; selBox.style.display = "block"; }
    else selBox.style.display = "none";

   // --- Post dinamici solo dell'utente ---
const postContainer = document.getElementById("postContainer");
document.getElementById("postUsername").textContent = utente.username;
postContainer.innerHTML = "";

try {
  const userId = utente._id.$oid || utente._id;
  const postsRes = await fetch(`http://localhost:8080/api/posts/utente/${userId}`, {
    headers: { Authorization: "Bearer " + token }
  });

  if (!postsRes.ok) throw new Error("Errore fetch post");

  const postsData = await postsRes.json();
  const posts = postsData.success ? postsData.posts : [];

  if (!posts.length) {
    postContainer.innerHTML = "<p class='no-posts'>Nessun post trovato.</p>";
    return;
  }

  posts.forEach(post => {
    const article = document.createElement("article");
    article.className = "post-card";
    
    // Costruzione struttura post
    article.innerHTML = `
      <header class="post-header">
        <img src="${utente.immagineProfilo || '../assets/default-pfp.jpg'}" alt="Avatar di ${safeText(utente.username)}">
        <div class="post-author-info">
          <div class="post-author-name">${safeText(utente.username)}</div>
          <time class="post-date">${safeText(post.createdAt ? new Date(post.createdAt).toLocaleDateString("it-IT") : "")}</time>
        </div>
      </header>
      
      <div class="post-details">
        <h3 class="post-title">${safeText(post.titolo)}</h3>
        <p class="post-text">${safeText(post.descrizione)}</p>
      </div>
      
      ${post.ImmaginePost ? `
        <div class="post-image-container">
          <img src="${post.ImmaginePost}" class="post-image" alt="Immagine del post ${safeText(post.titolo)}">
        </div>
      ` : ""}
      
      <footer class="post-footer">
        <div class="post-actions">
          <button class="like-button ${post.isLiked ? 'liked' : ''}" data-post-id="${post._id.$oid || post._id}">
            <i class="fas fa-star"></i>
            <span class="like-count">${post.likes || 0}</span>
          </button>
        </div>
      </footer>
    `;

    // Aggiunta al container
    postContainer.appendChild(article);
    
    // Event listener per il like
    const likeBtn = article.querySelector(".like-button");
    likeBtn.addEventListener("click", async function() {
      try {
        const postId = this.dataset.postId;
        const res = await fetch(`http://localhost:8080/api/posts/${postId}/like`, {
          method: "POST",
          headers: { 
            Authorization: "Bearer " + token,
            "Content-Type": "application/json"
          }
        });
        
        if (!res.ok) throw new Error("Errore nell'aggiornamento del like");
        
        const data = await res.json();
        if (data.success) {
          this.classList.toggle("liked");
          const countSpan = this.querySelector(".like-count");
          const currentLikes = parseInt(countSpan.textContent);
          countSpan.textContent = this.classList.contains("liked") ? currentLikes + 1 : currentLikes - 1;
        }
      } catch (err) {
        console.error("Errore like:", err);
        showPopup({ title: "Errore", text: "Impossibile aggiornare il like" });
      }
    });
  });

} catch (err) {
  console.error("Errore caricamento post:", err);
  postContainer.innerHTML = "<p class='no-posts'>Errore caricamento post.</p>";
}

  } catch (err) {
    console.error(err);
    showPopup({ title: "Errore", text: "Errore caricamento profilo" });
  }
}

// --- Popup follower/seguiti ---
function openUserList(type) {
  const ids = type === "follower" ? CURRENT.followerIds : CURRENT.seguitiIds;
  alert(`${type}:\n` + ids.join("\n"));
}

// --- Avvio ---
document.addEventListener("DOMContentLoaded", () => {
  caricaProfilo();
});
