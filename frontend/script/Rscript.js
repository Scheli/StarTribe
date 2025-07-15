/* document.addEventListener('DOMContentLoaded', function() {
    const showLoginBtn = document.getElementById('showLogin');
    const showRegisterBtn = document.getElementById('showRegister');
    const loginSection = document.getElementById('loginSection');
    const registerSection = document.getElementById('registerSection');

    // Funzione per mostrare la sezione di login e nascondere quella di registrazione
    function showLogin() {
        loginSection.classList.remove('hidden');
        registerSection.classList.add('hidden');
    }

    // Funzione per mostrare la sezione di registrazione e nascondere quella di login
    function showRegister() {
        registerSection.classList.remove('hidden');
        loginSection.classList.add('hidden');
    }

    // Aggiungi event listener ai pulsanti
    showLoginBtn.addEventListener('click', showLogin);
    showRegisterBtn.addEventListener('click', showRegister);

    // Potresti anche voler gestire l'invio dei form qui, ma per questa richiesta ci concentriamo sul toggle.
    // Esempio per prevenire l'invio predefinito (per scopi di test)
    document.querySelector('.comment-form').addEventListener('submit', function(event) {
        event.preventDefault(); // Impedisce il ricaricamento della pagina
        alert('Form inviato! (Simulazione)');
        // Qui potresti aggiungere la logica per inviare i dati al server
    });
}); */

const form = document.getElementById("contact-form");

form.addEventListener("submit", async function (event) {
  event.preventDefault();

  const formData = new FormData(event.target);

  const user = document.getElementById("name").value;
  const data = document.getElementById("date").value;
  const email = document.getElementById("email").value ;
  const password = document.getElementById("password").value;

  var isValid = validate(password, email,user,data);


  if (!isValid) {
    console.error("Validation failed!");
    return;
  }

 
  cleanup();

  
});

function validate(user,data,password, email) {
  let result = true;

  if (user == "") {
    document.getElementById("name").classList.add("error-input");
    result = false;
  }

  if (data == "") {
    document.getElementById("date").classList.add("error-input");
    result = false;
  }

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
  document.getElementById("name").value= "";
  document.getElementById("date").value= "";


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

function showMessage() {
  const popup = document.getElementById("popup");
  popup.classList.add("show");

  // Nasconde il popup dopo 5 secondi
  setTimeout(() => {
    popup.classList.remove("show");
  }, 5000);
}


