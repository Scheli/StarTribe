const form = document.getElementById("registerForm");
// checkbox e pulsante di invio
const termsCheckbox = document.getElementById('terms');
const submitBtn = document.getElementById('send-form');

// Il pulsante rimane sempre abilitato, la validazione avviene solo nel submit handler

// Funzione per creare popup sicuri
function showPopup({ title, text, duration = 1500 }) {
  const overlay = safeDom.createSafeElement('div', { className: 'welcome-overlay' });
  
  const popupDiv = safeDom.createSafeElement('div', { className: 'welcome-popup' });

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
    setTimeout(() => overlay.remove(), 600);
  }, duration);
}
window.addEventListener("load", () => {
  showPopup({
    title: "Benvenuto in StarTribe!",
    text: "Registrati per esplorare nuove galassie...",
    duration: 1000
  });
});

// Gestione del submit del form di registrazione
form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const username = form.username.value.trim();
  const email = form.email.value.trim();
  const password = form.password.value.trim();
  const birthdate = form.birthdate.value;

  if (!username || !email || !password || !birthdate) {
    showPopup({
      title: "Errore",
      text: "Compila tutti i campi.",
      duration: 1500
    });
    return;
  }

  // Verifica accettazione termini
  if (termsCheckbox && !termsCheckbox.checked) {
    const checkboxContainer = document.querySelector('.form-checkbox');
    checkboxContainer.classList.remove('shake');
    void checkboxContainer.offsetWidth;
    
    checkboxContainer.classList.add('shake');
    
    showPopup({
      title: "Errore",
      text: "Devi accettare i termini per registrarti.",
      duration: 1000
    });

    setTimeout(() => checkboxContainer.classList.remove('shake'), 500);
    
    termsCheckbox.focus();
    return;
  }

  try {
    const response = await fetch("http://localhost:8080/api/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, email, password, birthdate }),
    });

    const data = await response.json();

    if (response.ok) {
      if (data.token) localStorage.setItem("token", data.token);
      form.reset();

      // popup di benvenuto dopo registrazione
      showPopup({
        title: `Benvenuto ${username}!`,
        text: "La tua avventura spaziale sta per iniziare...",
        duration: 1500
      });
      
      setTimeout(() => (window.location.href = "/frontend/html/profilo.html"), 2000);
    } else {
      showPopup({
        title: "Errore",
        text: data.message || "Errore nella registrazione.",
        duration: 1500
      });
    }
  } catch (error) {
    console.error("Errore di rete:", error);
    showPopup({
      title: "Errore",
      text: "Errore di connessione al server.",
      duration: 1500
    });
  }
});