const form = document.getElementById("registerForm");
const message = document.getElementById("message");
const checkbox = document.getElementById("termsCheckbox");
const submitBtn = document.getElementById("registerBtn");
const termsContainer = document.getElementById("termsContainer");
// note: modal elements may be added after this script runs; resolve them lazily inside functions

// Helper: show welcome modal (uses HTML modal present in the page)
function showWelcomeModal({ title = 'Benvenuto', text = 'Prepariamo il tuo profilo...', duration = 2200 } = {}) {
  // try to resolve existing static modal in DOM
  let overlay = document.getElementById('modalOverlay');
  let progressEl = document.getElementById('modalProgress');
  let titleEl = document.getElementById('modalTitle');
  let textEl = document.getElementById('modalText');

  // If static modal exists, use it. Otherwise create a dynamic welcome-overlay like login.js
  let createdDynamically = false;
  if (!overlay) {
    createdDynamically = true;
    overlay = document.createElement('div');
    overlay.className = 'welcome-overlay';

    const popup = document.createElement('div');
    popup.className = 'welcome-popup';

    const img = document.createElement('img');
    img.src = '/frontend/assets/logo.png';
    img.alt = 'Logo';
    img.className = 'welcome-logo';

    titleEl = document.createElement('h2');
    textEl = document.createElement('p');

    const loadingBar = document.createElement('div');
    loadingBar.className = 'loading-bar';
    progressEl = document.createElement('div');
    progressEl.className = 'loading-fill';
    loadingBar.appendChild(progressEl);

    popup.appendChild(img);
    popup.appendChild(titleEl);
    popup.appendChild(textEl);
    popup.appendChild(loadingBar);
    overlay.appendChild(popup);
    document.body.appendChild(overlay);
  }

  if (titleEl) titleEl.textContent = title;
  if (textEl) textEl.textContent = text;

  overlay.style.display = 'flex';
  overlay.setAttribute('aria-hidden', 'false');
  if (progressEl) progressEl.style.width = '0%';

  // animate progress
  let progress = 0;
  const step = 100 / (duration / 80);
  const iv = setInterval(() => {
    progress = Math.min(100, progress + step);
    if (progressEl) progressEl.style.width = progress + '%';
    if (progress >= 100) {
      clearInterval(iv);
      // auto-close a bit after completion
      setTimeout(() => {
        if (createdDynamically) overlay.remove();
        else hideWelcomeModal();
      }, 450);
    }
  }, 80);

  // If static modal present, wire close button
  if (!createdDynamically) {
    const modalCloseBtn = document.getElementById('modalClose');
    modalCloseBtn?.addEventListener('click', () => {
      clearInterval(iv);
      hideWelcomeModal();
    }, { once: true });
  }
}

function hideWelcomeModal() {
  if (!modalOverlay) return;
  modalOverlay.style.display = 'none';
  modalOverlay.setAttribute('aria-hidden', 'true');
  modalProgress.style.width = '0%';
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

// ensure submit disabled if checkbox unchecked
if (submitBtn && checkbox) {
  submitBtn.disabled = !checkbox.checked;
  checkbox.addEventListener('change', () => {
    submitBtn.disabled = !checkbox.checked;
    if (checkbox.checked) {
      termsContainer.classList.remove('error');
      message.textContent = '';
    }
  });
}

// mostra un piccolo messaggio/modal al caricamento della pagina
window.addEventListener('load', () => {
  try {
    showWelcomeModal({ title: 'Benvenuto su StarTribe!', text: 'Crea il tuo account ed esplora lo spazio', duration: 1400 });
  } catch (e) {
    // non critico
    console.warn('showWelcomeModal on load failed', e);
  }
});

// ✅ Gestione form di registrazione
form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const username = form.username.value.trim();
  const email = form.email.value.trim();
  const password = form.password.value.trim();
  const birthdate = form.birthdate.value;

  if (!username || !email || !password || !birthdate) {
    message.textContent = "Compila tutti i campi.";
    message.style.color = "red";
    return;
  }



  //npm install helmet express-rate-limit --save
  // npm audit fix
  //> npm install express-mongo-sanitize --save

  // checkbox must be checked
  if (checkbox && !checkbox.checked) {
    message.textContent = 'Devi accettare i termini per registrarti.';
    message.style.color = 'red';
    termsContainer.classList.add('error');
    setTimeout(() => termsContainer.classList.remove('error'), 420);
    termsContainer.scrollIntoView({ behavior: 'smooth', block: 'center' });
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
      message.textContent = "Registrazione avvenuta con successo!";
      message.style.color = "green";

      if (data.token) localStorage.setItem("token", data.token);

      form.reset();

      // mostra il modal di benvenuto con barra di progresso
      try {
          // try to personalize with username inside token
          let title = 'Benvenuto in StarTribe!';
          if (data.token) {
            const payload = parseJwt(data.token);
            if (payload && payload.username) title = `Benvenuto ${payload.username}!`;
          }
          showWelcomeModal({ title, text: 'Registrazione completata con successo.', duration: 2200 });
      } catch (err) {
        console.warn('Errore mostrando il modal di benvenuto', err);
      }
    } else {
      message.textContent = data.message || "Errore nella registrazione.";
      message.style.color = "red";
    }
  } catch (error) {
    console.error("Errore di rete:", error);
    message.textContent = "Errore di connessione al server.";
    message.style.color = "red";
  }
});