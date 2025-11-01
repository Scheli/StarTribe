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
  div.innerHTML = `
    <h2>${apod.title}</h2>
    <img src="${apod.url}" alt="${apod.title}" style="max-width:100%;">
    <p>${apod.explanation}</p>
  `;
}

function mostraWeather(weather) {
  const div = document.getElementById('weather');
  const sol = weather.sol_keys[0];
  const tempData = weather[sol].AT;
  div.innerHTML = `
    <h3>Meteo su Marte</h3>
    <p>Media: ${tempData.av}°C | Min: ${tempData.mn}°C | Max: ${tempData.mx}°C</p>
  `;
}

document.addEventListener('DOMContentLoaded', fetchAllNews);