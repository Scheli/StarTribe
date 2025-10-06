const token = localStorage.getItem("token");

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

function isHttpUrl(v) {
  return typeof v === "string" && /^https?:\/\//i.test(v);
}

  async function Creapost() {
  const form = document.getElementById("uploadForm");
  const formData = new FormData(form);

  const token = localStorage.getItem("token");

  if (!token) {
    alert("Token mancante. Effettua il login.");
    return;
  }

  try {
    const response = await fetch("http://localhost:8080/api/pubblicapost", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`
      },
      body: formData
    });

    const raw = await response.text();
    let result;
    try {
      result = JSON.parse(raw);
    } catch {
      console.warn("Risposta non JSON:", raw);
      result = { message: raw };
    }

    if (response.ok) {
      alert(result.message || "Post pubblicato con successo!");
      form.reset();
    } else {
      alert(result.message || "Errore nella pubblicazione del post");
    }

  } catch (err) {
    console.error("Errore durante la fetch:", err);
    alert("Errore imprevisto nella pubblicazione del post.");
  }
}
