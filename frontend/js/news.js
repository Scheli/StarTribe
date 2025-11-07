const token = localStorage.getItem("token");

async function caricaUtentiConsigliati() {
  try {

    const response = await fetch('http://localhost:8080/news');
    if (!response.ok) throw new Error('Errore nella risposta della fetch');

    const utenti = await response.json();

    const utentiContainer = document.querySelector('.utenti');
    const navbarContainer = document.querySelector('.navbar');

    navbarContainer.innerHTML = `
      <div class="navbar-content">
        <div class="navbar-left">
          <h1 class="navbar-title">News</h1>
        </div>
        <div class="navbar-right" id="navbar-buttons"></div>
      </div>
      `;

    const navbarButtons = document.getElementById('navbar-buttons');

    if (!token) {
      utentiContainer.innerHTML = `
        <h3>Utenti suggeriti:</h3>
        <p>Effettua il login per visualizzare gli utenti</p>`

      navbarButtons.innerHTML = `
        <button class="news-icon-btn"><a href="/frontend/html/login.html" class="testoLink">Login</a></button>
        <button class="news-icon-btn"><a href="/frontend/html/registrazione.html" class="testoLink">Registrati</a></button>
      `;
    }
    else {
      utentiContainer.innerHTML = '<h3>Utenti suggeriti:</h3>';

      utenti.forEach(utente => {
        const div = document.createElement('div');
        div.classList.add('utente');

        const borderUrl = (utente.selectedBorder && utente.selectedBorder !== 'none')
          ? utente.selectedBorder
          : '';

        const imgSrc = utente.immagineProfilo
          ? utente.immagineProfilo
          : '/frontend/img/default-avatar-icon-of-social-media-user-vector.jpg';

        div.innerHTML = `
          <img src="${imgSrc}" alt="Immagine profilo">
          <p>${utente.username}</p>
          <p>Punteggio: ${utente.punti}</p>
          ${borderUrl ? `
            <div class="trophy-badge">
              <img class="trophy-icon" src="${borderUrl}" alt="Cornice selezionata">
            </div>` : ``}
        `;

        div.addEventListener('click', () => {
          localStorage.setItem('utenteVisualizzato', utente._id);
          window.location.href = '/frontend/html/ProEsterno.html';
        });

        utentiContainer.appendChild(div);
      });

      navbarButtons.innerHTML = `
        <button class="news-icon-btn"><a href="/frontend/html/chat.html" class="testoLink">💬</a></button>
        <button class="news-icon-btn"><a href="/frontend/html/pubblicapost.html" class="testoLink">➕</a></button>
        <button class="news-icon-btn"><a href="/frontend/html/visualizzapost.html" class="testoLink">🌍</a></button>
        <button class="news-icon-btn"><a href="/frontend/html/space_road.html" class="testoLink">🚀</a></button>
        <button class="news-icon-btn"><a href="/frontend/html/profilo.html" class="testoLink">👤</a></button>
        <button class="news-icon-btn"><a href="/frontend/html/index.html" class="testoLink">🏠</a></button>
      `;
    }

  } catch (error) {
    console.error('Errore nel caricamento utenti:', error);
  }
}

document.addEventListener('DOMContentLoaded', caricaUtentiConsigliati);

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

function mostraMeteoTerni(meteo) {
  const div = document.getElementById('meteo-terni');
  if (!div) return;

  while (div.firstChild) div.removeChild(div.firstChild);

  const h = document.createElement('h3');
  h.textContent = `Meteo a ${meteo.location.name}`;
  const p = document.createElement('p');
  p.textContent = `${meteo.current.condition.text}, ${meteo.current.temp_c}°C`;

  const img = document.createElement('img');
  img.src = "https:" + meteo.current.condition.icon;
  img.alt = meteo.current.condition.text;
  img.style.width = '64px';
  img.style.height = '64px';

  const details = document.createElement('p');
  details.textContent = `Vento: ${meteo.current.wind_kph} km/h | Umidità: ${meteo.current.humidity}%`;

  div.appendChild(h);
  div.appendChild(img);
  div.appendChild(p);
  div.appendChild(details);
}

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
document.addEventListener('DOMContentLoaded', fetchAllNews);

async function fetchMeteoTerni() {
  try {
    const res = await fetch('http://localhost:8080/news/meteoTerni');
    if (!res.ok) throw new Error('Errore nella fetch del meteo a Terni');

    const data = await res.json();
    mostraMeteoTerni(data);
  } catch (err) {
    console.error('Errore nel caricamento del meteo a Terni:', err);
  }
}

document.addEventListener('DOMContentLoaded', fetchMeteoTerni);