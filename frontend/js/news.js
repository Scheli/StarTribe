async function caricaUtentiConsigliati() {
  try {
    const response = await fetch('/news');
    if (!response.ok) throw new Error('Errore nella risposta della fetch');
    
    const utenti = await response.json();
    const utentiContainer = document.querySelector('.utenti');
    
    // Pulisci prima di aggiungere
    utentiContainer.innerHTML = '<h3>Utenti suggeriti:</h3>';
    
    utenti.forEach(utente => {
      const elemento = creaElementoUtente(utente);
      utentiContainer.appendChild(elemento);
    });
  } catch (error) {
    console.error('Errore nel caricamento utenti:', error);
  }
}

// Chiama la funzione quando la pagina è pronta
document.addEventListener('DOMContentLoaded', caricaUtentiConsigliati);