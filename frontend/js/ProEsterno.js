const utenteId = localStorage.getItem("utenteVisualizzato");
const token = localStorage.getItem("token");

let seguitiCorrenti = [];

if (!utenteId) {
  document.body.innerHTML = "<p>Utente non selezionato</p>";
} else {
  fetch(`http://localhost:8080/api/utente/${utenteId}`)
    .then(res => res.json())
    .then(data => {
      if (!data.success) {
        document.body.innerHTML = `<p>${data.message}</p>`;
        return;
      }

      const u = data.utente;
      document.getElementById("username").innerText = u.username;
      document.getElementById("punti").innerText = u.punti;
      document.getElementById("immagineProfilo").src = u.immagineProfilo;
      document.getElementById("immagineProfilo").style.width = "200px";
      document.getElementById("selectedBorder").src = u.selectedBorder;

      if (u.bannerProfilo) {
        document.getElementById("banner").innerHTML = `<img src="${u.bannerProfilo}" style="width: 100%; max-height: 500px; object-fit: cover; object-position: top;">`;
      }

      if (token) {
        fetch("http://localhost:8080/api/profilo", {
          headers: {
            Authorization: `Bearer ${token}`
          }
        })
        .then(res => res.json())
        .then(authData => {
          const mioId = authData.utente._id;
          seguitiCorrenti = authData.utente.seguiti || [];

          if (mioId === utenteId) return; 

          const btn = document.createElement("button");
          btn.id = "btnFollow";

          const segueGià = seguitiCorrenti.includes(utenteId);
          btn.textContent = segueGià ? "Seguito" : "Segui";
          btn.onclick = () => {
            if (btn.textContent === "Segui") {
              seguiUtente(utenteId, btn);
            } else {
              unfollowUtente(utenteId, btn);
            }
          };

          document.getElementById("profiloEsterno").appendChild(btn);
        });
      }
    })
    .catch(err => {
      console.error("Errore caricamento profilo:", err);
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
      alert("Hai iniziato a seguire l'utente!");
      bottone.textContent = "Seguito";
    } else {
      alert(data.message);
    }
  } catch (err) {
    console.error("Errore durante il follow:", err);
    alert("Errore durante la richiesta follow");
  }
}

async function unfollowUtente(id, bottone) {
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
      alert("Hai smesso di seguire l'utente.");
      bottone.textContent = "Segui";
    } else {
      alert(data.message);
    }
  } catch (err) {
    console.error("Errore durante unfollow:", err);
    alert("Errore durante la richiesta unfollow");
  }
}
