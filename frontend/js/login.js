const form = document.getElementById("loginForm");
const message = document.getElementById("message");

// ✅ Popup modale dinamico
function showPopup({ title, text, duration = 1500 }) {
  const overlay = document.createElement("div");
  overlay.className = "welcome-overlay";

  const isError = title.toLowerCase().includes("errore");

  overlay.innerHTML = `
    <div class="welcome-popup ${isError ? "error-popup" : ""}">
      <img src="/frontend/assets/logo.png" alt="Logo" class="welcome-logo">
      <h2>${title}</h2>
      <p>${text}</p>
      <div class="loading-bar"><div class="loading-fill"></div></div>
    </div>
  `;
  document.body.appendChild(overlay);

  setTimeout(() => {
    overlay.style.opacity = "0";
    overlay.style.transition = "opacity 0.5s ease";
    setTimeout(() => overlay.remove(), 200);
  }, duration);
}

// ✅ Popup iniziale all’apertura
window.addEventListener("load", () => {
  showPopup({
    title: "Benvenuto in StarTribe!",
    text: "Preparati a esplorare nuove galassie...",
    duration: 1500
  });
});

// ✅ Login form
form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const email = form.email.value.trim();
  const password = form.password.value.trim();

  if (!email || !password) {
    showPopup({ title: "Errore", text: "Compila tutti i campi!", duration: 1500 });
    return;
  }

  try {
    const response = await fetch("http://localhost:8080/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    const data = await response.json();

    if (response.ok) {
      showPopup({
        title: "Login riuscito!",
        text: "Accesso effettuato con successo, Bentornato!",
        duration: 1500
      });

      if (data.token) {
        localStorage.setItem("token", data.token);
        setTimeout(() => (window.location.href = "/frontend/html/profilo.html"), 1500);
      }

      form.reset();
    } else {
      showPopup({
        title: "Errore nel login",
        text: data.message || "Credenziali non valide.",
        duration: 1500
      });
    }
  } catch (error) {
    console.error("Errore di rete:", error);
    showPopup({ title: "Errore", text: "Connessione al server non riuscita.", duration: 2500 });
  }
});
