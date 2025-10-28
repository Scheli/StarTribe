const token = localStorage.getItem("token");

async function caricaUtentiConsigliati() {
  try {
    const response = await fetch('http://localhost:8080/news');
    if (!response.ok) throw new Error('Errore nella risposta della fetch');

    const utenti = await response.json();

    const utentiContainer = document.querySelector('.utenti');

    if (!token) {
      const navbarContainer = document.querySelector('.navbar');

      utentiContainer.innerHTML=` <h3>Utenti suggeriti:</h3>
      <p>Effettua il login per visualizzare gli utenti</p>`;

      navbarContainer.innerHTML=`
      <img src="/frontend/assets/logo.png" class="logoNavbar"/>

      <button class="news-icon-btn">
        <a href="/frontend/html/login.html" class="testoLink">Login</a>
      </button>
      <button class="news-icon-btn">
        <a href="/frontend/html/registrazione.html" class="testoLink">Registrati</a>
      </button>`
    }
    
    else {

    const footerContainer = document.querySelector('.footer');

    utentiContainer.innerHTML = '<h3>Utenti suggeriti:</h3>';

    utenti.forEach(utente => {
      const div = document.createElement('div');
      div.classList.add('utente');

      const borderUrl = (utente.selectedBorder && utente.selectedBorder !== 'none')
        ? utente.selectedBorder
        : '';
    
    if (utente.immagineProfilo){
      div.innerHTML = `
        <img src="${utente.immagineProfilo}" alt="Immagine profilo">
      <p>${utente.username}</p>
      <p>Punteggio: ${utente.punti}</p>
      ${borderUrl ? `
        <div class="trophy-badge">
          <img class="trophy-icon" src="${borderUrl}" alt="Cornice selezionata">
        </div>` : ``}`
    }
    else {
      div.innerHTML = `
        <img src="/frontend/img/default-avatar-icon-of-social-media-user-vector.jpg" alt="Immagine profilo">
      <p>${utente.username}</p>
      <p>Punteggio: ${utente.punti}</p>
      ${borderUrl ? `
        <div class="trophy-badge">
          <img class="trophy-icon" src="${borderUrl}" alt="Cornice selezionata">
        </div>` : ``}`
    }

      div.addEventListener('click', () => {
        localStorage.setItem('utenteVisualizzato', utente._id);
        window.location.href = '/frontend/html/ProEsterno.html';
      });

      utentiContainer.appendChild(div);
    });

    footerContainer.innerHTML=`
    <button class="news-icon-btn">
      <a href="/frontend/html/chat.html" class="testoLink">💬</a>
    </button>
    <button class="news-icon-btn">
      <a href="/frontend/html/pubblicapost.html" class="testoLink">➕</a>
    </button>
    <button class="news-icon-btn">
      <a href="/frontend/html/visualizzapost.html" class="testoLink">🌍</a>
    </button>`
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
  div.innerHTML = `<h3>Meteo su Marte</h3>
  <p>Media: ${tempData.av}°C | Min: ${tempData.mn}°C | Max: ${tempData.mx}°C</p>`;
}

document.addEventListener('DOMContentLoaded', fetchAllNews);