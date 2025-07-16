const utenteId = localStorage.getItem("utenteVisualizzato");

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

     if (u.bannerProfilo) {
  document.getElementById("banner").innerHTML = `<img src="${u.bannerProfilo}" style="width: 100%; max-height: 600px; object-fit: cover; object-position: top;">`;
}

    })
    .catch(err => {
      console.error("Errore caricamento profilo:", err);
    });
}
