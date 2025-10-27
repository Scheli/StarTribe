const form = document.getElementById("loginForm");
const message = document.getElementById("message");

// ✅ Popup modale dinamico
function showPopup({ title, text, duration = 1500 }) {
  // create elements safely (avoid inserting untrusted HTML)
  const overlay = document.createElement('div');
  overlay.className = 'welcome-overlay';

  const popup = document.createElement('div');
  popup.className = 'welcome-popup';

  // detect error for styling
  const isError = typeof title === 'string' && title.toLowerCase().includes('errore');
  if (isError) popup.classList.add('error-popup');

  const img = document.createElement('img');
  img.src = '/frontend/assets/logo.png';
  img.alt = 'Logo';
  img.className = 'welcome-logo';

  const h2 = document.createElement('h2');
  h2.textContent = title;

  const p = document.createElement('p');
  p.textContent = text;

  const loadingBar = document.createElement('div');
  loadingBar.className = 'loading-bar';
  const loadingFill = document.createElement('div');
  loadingFill.className = 'loading-fill';
  loadingBar.appendChild(loadingFill);

  popup.appendChild(img);
  popup.appendChild(h2);
  popup.appendChild(p);
  popup.appendChild(loadingBar);

  overlay.appendChild(popup);
  document.body.appendChild(overlay);

  // animate removal
  setTimeout(() => {
    overlay.style.opacity = '0';
    overlay.style.transition = 'opacity 0.5s ease';
    setTimeout(() => overlay.remove(), 200);
  }, duration);
}

// ✅ Popup iniziale all’apertura
window.addEventListener("load", () => {
  showPopup({
    title: "Bentornato in StarTribe!",
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
    // show a loading modal while waiting
    const loader = createLoadingOverlay({ title: 'Accesso in corso', text: 'Verificando credenziali...' });

    const response = await fetch("http://localhost:8080/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    // stop loading overlay once response received
    loader?.stop?.();

    const contentType = response.headers.get('content-type') || '';
    let data;
    if (contentType.includes('application/json')) {
      data = await response.json();
    } else {
      // non-JSON response (HTML error page or plain text)
      data = await response.text();
    }

    if (response.ok) {
      // try to extract username from token to personalize welcome
      let welcomeTitle = 'Login riuscito!';
      if (data.token) {
        try {
          const payload = parseJwt(data.token);
          if (payload && payload.username) welcomeTitle = `Benvenuto ${payload.username}!`;
        } catch (e) { /* ignore */ }
      }
      showPopup({ title: welcomeTitle, text: 'Accesso effettuato con successo!', duration: 1500 });

      if (data.token) {
        localStorage.setItem("token", data.token);
        setTimeout(() => (window.location.href = "/frontend/html/profilo.html"), 1500);
      }

      form.reset();
    } else {
      const msg = (data && data.message) ? data.message : (typeof data === 'string' ? data : 'Credenziali non valide.');
      showPopup({
        title: "Errore nel login",
        text: msg,
        duration: 2000
      });
    }
  } catch (error) {
    console.error("Errore di rete:", error);
    showPopup({ title: "Errore", text: "Connessione al server non riuscita.", duration: 2500 });
    // ensure loader removed on network error
    // (in case loader wasn't stopped above)
    document.querySelectorAll('.welcome-overlay[data-loading="1"]').forEach(el => el.remove());
  }
});

// create a loading overlay with progress controllable by JS; returns { stop }
function createLoadingOverlay({ title = 'Caricamento', text = '' } = {}) {
  const overlay = document.createElement('div');
  overlay.className = 'welcome-overlay';
  overlay.setAttribute('data-loading', '1');

  const popup = document.createElement('div');
  popup.className = 'welcome-popup';

  const img = document.createElement('img');
  img.src = '/frontend/assets/logo.png';
  img.alt = 'Logo';
  img.className = 'welcome-logo';

  const h2 = document.createElement('h2');
  h2.textContent = title;

  const p = document.createElement('p');
  p.textContent = text;

  const loadingBar = document.createElement('div');
  loadingBar.className = 'loading-bar';
  const fill = document.createElement('div');
  fill.className = 'loading-fill';
  loadingBar.appendChild(fill);

  popup.appendChild(img);
  popup.appendChild(h2);
  popup.appendChild(p);
  popup.appendChild(loadingBar);

  overlay.appendChild(popup);
  document.body.appendChild(overlay);
  let width = 0;
  const iv = setInterval(() => {
    width = Math.min(98, width + Math.random() * 8 + 2);
    if (fill) fill.style.width = width + '%';
  }, 220);

  return {
    stop: (finalDelay = 200) => {
      clearInterval(iv);
      if (fill) fill.style.width = '100%';
      setTimeout(() => {
        overlay.style.opacity = '0';
        overlay.style.transition = 'opacity 0.3s ease';
        setTimeout(() => overlay.remove(), 320);
      }, finalDelay);
    }
  };
}

// lightweight JWT payload parser (no verification) - safe for display only
function parseJwt(token) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = parts[1];
    const decoded = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(decodeURIComponent(escape(decoded)));
  } catch (e) {
    return null;
  }
}
