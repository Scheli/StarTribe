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
  try { return await res.json(); } catch { return { success:false, message:"Errore JSON" }; }
}

function isHttpUrl(v) {
  return typeof v === "string" && /^https?:\/\//i.test(v);
}

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

function getBorderUrl(v) {
  if (!v) return "";
  if (isHttpUrl(v)) return v;
  return BORDER_URLS[String(v).toLowerCase()] || "";
}

function keyFromAny(v) {
  if (!v) return "none";
  return isHttpUrl(v) ? keyFromBorderUrl(v) : String(v).toLowerCase();
}

let CURRENT = {
  avatarBaseUrl: "",      
  unlocked: [],           
  selectedBorder: "none", 
};

async function caricaProfilo() {
  if (!token) {
    document.body.innerHTML = "<p>Token mancante. Esegui il login.</p>";
    return;
  }

  try {
    const res = await fetch("http://localhost:8080/api/profilo", {
      headers: { Authorization: "Bearer " + token }
    });
    const data = await res.json();
    if (!data.success) {
      document.body.innerHTML = "<p>Accesso negato: " + (data.message || "Errore") + "</p>";
      return;
    }

    // Visualizzazione
    document.getElementById("usernameDisplay").textContent = data.utente.username;
    document.getElementById("emailDisplay").textContent    = data.utente.email;
    document.getElementById("birthdateDisplay").textContent= safeBirthdateStr(data.utente.birthdate);
    document.getElementById("puntiDisplay").textContent    = data.utente.punti;

    // Modale
    document.getElementById("usernameInput").value  = data.utente.username;
    document.getElementById("emailInput").value     = data.utente.email;
    document.getElementById("birthdateInput").value = safeBirthdateStr(data.utente.birthdate);
    document.getElementById("puntiInput").value     = data.utente.punti;


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

document.getElementById("uploadForm").addEventListener("submit", async (e) => {
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
  document.getElementById("messaggio").innerText = data.message || "Upload completato";
  await caricaProfilo();
});

document.getElementById("bannerForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const file = document.querySelector('#bannerForm input[name="file"]').files[0];
  if (!file || !token) return;

  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch("http://localhost:8080/api/upload/banner", {
    method: "POST",
    headers: { Authorization: "Bearer " + token },
    body: formData
  });

  const data = await res.json();
  document.getElementById("messaggio").innerText = data.message || "Banner caricato";
  await caricaProfilo();
});

document.getElementById("modificaForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const username = document.getElementById("usernameInput").value;
  const birthdate = document.getElementById("birthdateInput").value;

  const res = await fetch("http://localhost:8080/api/profilo/update", {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + token
    },
    body: JSON.stringify({ username, birthdate })
  });

  const data = await res.json();
  alert(data.message || "Modifica completata");
  await caricaProfilo();
});

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
      if (!isUnlocked) {
        img.classList.add("locked");
        return;
      }

      img.onclick = () => handleBorderClick(key);
      if (key === selectedKey) img.classList.add("selected");
    });
  } catch (err) {
    console.error("setupBordersUI error:", err);
  }
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
    alert(selData.message || "Impossibile selezionare la cornice");
    return;
  }

  CURRENT.selectedBorder = url || "none";
  document.querySelectorAll(".pfp-border").forEach(i => i.classList.remove("selected"));
  const el = document.querySelector(`.pfp-border[data-border="${key}"]`);
  if (el) el.classList.add("selected");

  document.getElementById("messaggio").innerText = "Cornice selezionata!";
}

caricaProfilo();