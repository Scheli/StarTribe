const form = document.getElementById("loginForm");

// Funzione per creare popup sicuri
function showPopup({ title, text, duration = 1500 }) {
  const overlay = safeDom.createSafeElement('div', { className: 'welcome-overlay' });
  
  const isError = title.toLowerCase().includes("errore");
  const popupDiv = safeDom.createSafeElement('div', { 
    className: `welcome-popup ${isError ? "error-popup" : ""}`
  });

  const logo = safeDom.createSafeElement('img', {
    className: 'welcome-logo',
    src: '/frontend/assets/logo.png'
  });
  logo.alt = 'Logo';

  const titleElement = safeDom.createSafeElement('h2', {}, title);
  const textElement = safeDom.createSafeElement('p', {}, text);
  
  const loadingBar = safeDom.createSafeElement('div', { className: 'loading-bar' });
  const loadingFill = safeDom.createSafeElement('div', { className: 'loading-fill' });
  
  loadingBar.appendChild(loadingFill);
  popupDiv.append(logo, titleElement, textElement, loadingBar);
  overlay.appendChild(popupDiv);
  document.body.appendChild(overlay);

  setTimeout(() => {
    overlay.style.opacity = "0";
    overlay.style.transition = "opacity 0.5s ease";
    setTimeout(() => overlay.remove(), 200);
  }, duration);
}

//popup di benvenuto al caricamento della pagina
window.addEventListener("load", () => {
  showPopup({
    title: "StarTribe Login",
    text: "Preparati a esplorare nuove galassie...",
    duration: 1000
  });
});

// Gestione del submit del form di login
form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const email = form.email.value.trim();
  const password = form.password.value.trim();

  if (!email || !password) {
    showPopup({ title: "Errore", text: "Compila tutti i campi!", duration: 1500 });
    return;
  }

  try {
    console.log('Invio richiesta di login...');
    const response = await fetch("http://localhost:8080/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    console.log('Risposta ricevuta:', response.status);
    const data = await response.json();
    console.log('Dati ricevuti:', data);

    if (response.ok) {
      if (data.token) {
        localStorage.setItem("token", data.token);
        // Decodifica il token per ottenere le informazioni dell'utente
        const tokenParts = data.token.split('.');
        const tokenPayload = JSON.parse(atob(tokenParts[1]));
        console.log('Info dal token:', tokenPayload);
        
        const username = tokenPayload.username || "esploratore";
        
        showPopup({
          title: username,
          text: "Bentornato in StarTribe!",
          duration: 1000
        });
        
        setTimeout(() => {
          form.reset();
          window.location.href = "/frontend/html/profilo.html";
        }, 1500);
      }
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
