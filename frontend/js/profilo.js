const token = localStorage.getItem("token");

function èVideo(url) {
  return /\.(mp4|webm|mov)$/i.test(url);
}

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
      document.body.innerHTML = "<p>Accesso negato: " + data.message + "</p>";
      return;
    }

    document.getElementById("username").value = data.utente.username;
    document.getElementById("email").value = data.utente.email;
    document.getElementById("birthdate").value = data.utente.birthdate.split("T")[0];
    document.getElementById("punti").value = data.utente.punti;

    const media = document.getElementById("mediaProfilo");
    media.innerHTML = "";
    if (data.utente.immagineProfilo) {
      if (èVideo(data.utente.immagineProfilo)) {
        media.innerHTML = `<video width="320" controls src="${data.utente.immagineProfilo}"></video>`;
      } else {
        media.innerHTML = `<img src="${data.utente.immagineProfilo}" alt="Immagine profilo" width="200"/>`;
      }
    }
  } catch (err) {
    console.error(err);
  }
}

document.getElementById("uploadForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const file = document.querySelector('input[name="file"]').files[0];
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

document.getElementById("modificaForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const username = document.getElementById("username").value;
  const birthdate = document.getElementById("birthdate").value;

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

caricaProfilo();
