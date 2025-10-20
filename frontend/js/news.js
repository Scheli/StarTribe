async function caricaUtentiConsigliati() {
  try {
    const response = await fetch('http://localhost:8080/news');
    if (!response.ok) throw new Error('Errore nella risposta della fetch');

    const utenti = await response.json();
    const utentiContainer = document.querySelector('.utenti');

    utentiContainer.innerHTML = '<h3>Utenti suggeriti:</h3>';

    utenti.forEach(utente => {
      const div = document.createElement('div');
      div.classList.add('utente');

      const borderUrl = (utente.selectedBorder && utente.selectedBorder !== 'none')
        ? utente.selectedBorder
        : '';

      div.innerHTML = `
  <img src="${utente.immagineProfilo}" alt="Immagine profilo">
  ${borderUrl ? `
    <div class="trophy-badge">
      <img class="trophy-icon" src="${borderUrl}" alt="Cornice selezionata">
    </div>` : ``}
  <p>${utente.username}</p>
  <p>Punteggio: ${utente.punti}</p>
`;


      div.addEventListener('click', () => {
        localStorage.setItem('utenteVisualizzato', utente._id);
        window.location.href = '/frontend/html/ProEsterno.html';
      });

      utentiContainer.appendChild(div);
    });

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
  div.innerHTML = `<h3>Meteo su Marte</h3>
  <p>Media: ${tempData.av}°C | Min: ${tempData.mn}°C | Max: ${tempData.mx}°C</p>`;
}

document.addEventListener('DOMContentLoaded', fetchAllNews);