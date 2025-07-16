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
  div.innerHTML = `
    <img src="${utente.immagineProfilo}">
    <p><strong>Username:</strong> ${utente.username}</p>
    <p><strong>Punteggio:</strong> ${utente.punti}</p>
  `;
  div.style.cursor = 'pointer';
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
    mostra10FotoSelezionate(data.roverPhoto);
    mostraImageLibrary(data.imageLibrary);
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
  const sol = weather.sol_keys[0]; // es: "1210"
  const tempData = weather[sol].AT;   
  div.innerHTML = `<h3>Meteo su Marte</h3>
  <p>Media: ${tempData.av}°C | Min: ${tempData.mn}°C | Max: ${tempData.mx}°C</p>`;
}

function mostraRoverPhoto(photo) {
  const div = document.getElementById('roverPhoto');
  div.innerHTML = `<h3>Foto dal rover</h3>
    <img src="${photo.img_src}" alt="Mars rover photo" style="max-width:100%;">`;
}

function mostraImageLibrary(image) {
  const div = document.getElementById('imageLibrary');
  div.innerHTML = `<h3>Immagine NASA</h3>
    <img src="${image.url}" alt="${image.title}" style="max-width:100%;">`;
}

function mostra10FotoSelezionate(data) {
  const container = document.getElementById('roverPhoto');
  container.innerHTML = '<h3>Foto dal rover</h3>';

  if (!data.photos || data.photos.length === 0) {
    container.innerHTML += '<p>Nessuna foto disponibile.</p>';
    return;
  }

  const prime5 = data.photos.slice(0, 15);
  const ultime5 = data.photos.slice(-5);
  const fotoSelezionate = [...prime5, ...ultime5];

  fotoSelezionate.forEach(photo => {
    const img = document.createElement('img');
    img.src = photo.img_src;
    img.alt = 'Foto da Marte';
    img.style.width = '100%';
    img.style.maxWidth = '200px';
    img.style.margin = '10px';
    img.style.borderRadius = '8px';
    container.appendChild(img);
  });
}


document.addEventListener('DOMContentLoaded', fetchAllNews);

