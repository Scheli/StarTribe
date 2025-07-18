const form = document.getElementById("contact-form");

form.addEventListener("submit", async function (event) {
  event.preventDefault();

  const formData = new FormData(event.target);

  
  const email = document.getElementById("email").value ;
  const password = document.getElementById("password").value;

  var isValid = validate(password, email);


  if (!isValid) {
    console.error("Validation failed!");
    return;
  }

 
  cleanup();

  
});

function validate(password, email) {
  let result = true;

  if (password == "") {
    document.getElementById("password").classList.add("error-input");
    result = false;
  }

  if (email == ""||email==null) {
    document.getElementById("email").classList.add("error-input");
    result = false;
  }

  return result;
}

function cleanup() {
  document.getElementById("email").value = "";
  document.getElementById("password").value = "";
}

document
  .getElementById("consents")
  .addEventListener("change", async function () {
    if (this.checked) {
      document.getElementById("send-form").disabled = false;
    } else {
      document.getElementById("send-form").disabled = true;
    }
  });

const inputs = document.querySelectorAll("input");
inputs.forEach(input => {
  input.addEventListener("click", function () {
    console.log("Input cliccato!");

    // Rimuove la classe da tutti gli input
    inputs.forEach(i => i.classList.remove("error-input"));
  });
});

/* function showMessage() {
  const popup = document.getElementById("popup");
  popup.classList.add("show");

  // Nasconde il popup dopo 5 secondi
  setTimeout(() => {
    popup.classList.remove("show");
  }, 5000);

}
 */

 function showPopup(message, isError = false) {
    const popupContent = document.getElementById('popupContent');
    const popupOverlay = document.getElementById('popupOverlay');
    const popupContainer = document.getElementById('popupContainer'); // Ottieni il contenitore per gli stili di errore

    // Rimuovi eventuali classi di errore precedenti
    popupContainer.classList.remove('popup-error');

    let title;
    let imageSrc;
    let imageAlt;
    let popupClass = ''; // Per applicare stili specifici all'errore

    if (isError) {
        title = 'Accesso Negato!';
        imageSrc = 'https://via.placeholder.com/150/FF0000/FFFFFF?text=Errore'; // Immagine rossa per errore
        imageAlt = 'Errore Login';
        popupClass = 'popup-error'; // Aggiungi questa classe per gli stili di errore
    } else {
        title = 'Accesso Riuscito!';
        imageSrc = 'https://via.placeholder.com/150/28a745/FFFFFF?text=Successo'; // Immagine verde per successo
        imageAlt = 'Successo Login';
    }

    const customContent = `
        <h2>${title}</h2>
        <p>${message}</p>
        <p>${isError ? 'Riprova, le stelle ti aspettano!' : 'Benvenuto nella tua area stellare!'}</p>
        <img src="${imageSrc}" alt="${imageAlt}" style="max-width: 100%; height: auto; margin-top: 15px;">
    `;
    
    popupContent.innerHTML = customContent;
    
    // Aggiungi la classe di errore se necessario
    if (popupClass) {
        popupContainer.classList.add(popupClass);
    }

    popupOverlay.classList.add('show-popup');
}

function closePopup() {
    const popupOverlay = document.getElementById('popupOverlay');
    popupOverlay.classList.remove('show-popup');
    // Rimuovi la classe di errore alla chiusura per pulizia
    document.getElementById('popupContainer').classList.remove('popup-error');
}

// Funzione richiamata dall'onclick del bottone di login
function handleLoginClick() {
    const usernameInput = document.getElementById('username');
    const passwordInput = document.getElementById('password');

    // Credenziali simulate per il test
    const correctUsername = 'explorer';
    const correctPassword = 'stardate';

    if (usernameInput.value === correctUsername && passwordInput.value === correctPassword) {
        showPopup('Le tue credenziali cosmiche sono corrette!');
    } else {
        showPopup('Nome utente o password non validi. Controlla le tue coordinate celesti.', true); // true indica che è un errore
    }
}

// Event listeners per la chiusura del popup
document.addEventListener('DOMContentLoaded', () => {
    const closePopupBtn = document.getElementById('closePopupBtn');
    const popupOverlay = document.getElementById('popupOverlay');

    closePopupBtn.addEventListener('click', closePopup);

    popupOverlay.addEventListener('click', (event) => {
        if (event.target === popupOverlay) {
            closePopup();
        }
    });

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && popupOverlay.classList.contains('show-popup')) {
            closePopup();
        }
    });
});