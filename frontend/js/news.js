const token = localStorage.getItem("token");

async function caricaUtentiConsigliati() {
  try {
    const response = await fetch('http://localhost:8080/news');
    if (!response.ok) throw new Error('Errore nella risposta della fetch');

    const utenti = await response.json();

    const utentiContainer = document.querySelector('.utenti');

    if (!token) {
      const navbarContainer = document.querySelector('.navbar');

  while (utentiContainer.firstChild) utentiContainer.removeChild(utentiContainer.firstChild);
  const h = document.createElement('h3'); h.textContent = 'Utenti suggeriti:';
  const p = document.createElement('p'); p.textContent = 'Effettua il login per visualizzare gli utenti';
  utentiContainer.appendChild(h); utentiContainer.appendChild(p);

      // restore original navbar markup
      navbarContainer.innerHTML = `
      <img src="/frontend/assets/logo.png" class="logoNavbar"/>

      <button class="news-icon-btn">
        <a href="/frontend/html/login.html" class="testoLink">Login</a>
      </button>
      <button class="news-icon-btn">
        <a href="/frontend/html/registrazione.html" class="testoLink">Registrati</a>
      </button>`;
    }
    
    else {

    const footerContainer = document.querySelector('.footer');

  while (utentiContainer.firstChild) utentiContainer.removeChild(utentiContainer.firstChild);
    const header = document.createElement('h3'); header.textContent = 'Utenti suggeriti:';
    utentiContainer.appendChild(header);

    utenti.forEach(utente => {
      const div = document.createElement('div');
      div.classList.add('utente');

      const borderUrl = (utente.selectedBorder && utente.selectedBorder !== 'none')
        ? utente.selectedBorder
        : '';
    
    const imgEl = document.createElement('img');
    imgEl.alt = 'Immagine profilo';
    if (utente.immagineProfilo && (/^https?:\/\//i.test(utente.immagineProfilo) || utente.immagineProfilo.startsWith('/'))) imgEl.src = utente.immagineProfilo;
    else imgEl.src = '/frontend/img/default-avatar-icon-of-social-media-user-vector.jpg';

    const pName = document.createElement('p'); pName.textContent = (window.safeDom && window.safeDom.sanitizeText) ? window.safeDom.sanitizeText(utente.username || '') : (utente.username || '');
    const pPunti = document.createElement('p'); pPunti.textContent = 'Punteggio: ' + (utente.punti || 0);
    div.appendChild(imgEl); div.appendChild(pName); div.appendChild(pPunti);
    if (borderUrl) {
      const badge = document.createElement('div'); badge.className = 'trophy-badge';
      const bimg = document.createElement('img'); bimg.className = 'trophy-icon';
      if (/^https?:\/\//i.test(borderUrl) || borderUrl.startsWith('/')) bimg.src = borderUrl;
      bimg.alt = 'Cornice selezionata';
      badge.appendChild(bimg);
      div.appendChild(badge);
    }

      div.addEventListener('click', () => {
        localStorage.setItem('utenteVisualizzato', utente._id);
        window.location.href = '/frontend/html/ProEsterno.html';
      });

      utentiContainer.appendChild(div);
    });

    // restore original footer markup
    footerContainer.innerHTML = `

    <button class="news-icon-btn">
      <a href="/frontend/html/chat.html" class="testoLink">💬</a>
    </button>
    <button class="news-icon-btn">
      <a href="/frontend/html/pubblicapost.html" class="testoLink">➕</a>
    </button>
    <button class="news-icon-btn">
      <a href="/frontend/html/visualizzapost.html" class="testoLink">🌍</a>
    </button>
    <button class="news-icon-btn">
      <a href="/frontend/html/space_road.html" class="testoLink">🚀</a>
    </button>
    <button class="news-icon-btn">
      <a href="/frontend/html/profilo.html" class="testoLink">👤</a>
    </button>`;
  }
}
  catch (error) {
    console.error('Errore nel caricamento utenti:', error);
  }
}

document.addEventListener('DOMContentLoaded', caricaUtentiConsigliati);

async function fetchAllNews() {
  try {
    const res = await fetch('http://localhost:8080/news/all');
    if (!res.ok) throw new Error('Errore nella fetch');

    const data = await res.json();
    mostraAPOD(data.apod);
    mostraWeather(data.weather);
  } catch (err) {
    console.error('Errore nel caricamento dati:', err);
  }
}

function mostraAPOD(apod) {
  const div = document.getElementById('apod');
  while (div.firstChild) div.removeChild(div.firstChild);
  const h = document.createElement('h2'); h.textContent = (window.safeDom && window.safeDom.sanitizeText) ? window.safeDom.sanitizeText(apod.title || '') : (apod.title || '');
  if (apod.url && /^https?:\/\//i.test(apod.url)) {
    const img = document.createElement('img'); img.src = apod.url; img.alt = apod.title || ''; img.style.maxWidth = '100%'; div.appendChild(h); div.appendChild(img);
  } else {
    div.appendChild(h);
  }
  const p = document.createElement('p'); p.textContent = (window.safeDom && window.safeDom.sanitizeText) ? window.safeDom.sanitizeText(apod.explanation || '') : (apod.explanation || '');
  div.appendChild(p);
}

function mostraWeather(weather) {
  const div = document.getElementById('weather');
  const sol = weather.sol_keys[0];
  const tempData = weather[sol].AT;
  while (div.firstChild) div.removeChild(div.firstChild);
  const h = document.createElement('h3'); h.textContent = 'Meteo su Marte';
  const p = document.createElement('p');
  p.textContent = `Media: ${tempData.av}°C | Min: ${tempData.mn}°C | Max: ${tempData.mx}°C`;
  div.appendChild(h); div.appendChild(p);
}

document.addEventListener('DOMContentLoaded', fetchAllNews);