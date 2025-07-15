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

function showMessage() {
  const popup = document.getElementById("popup");
  popup.classList.add("show");

  // Nasconde il popup dopo 5 secondi
  setTimeout(() => {
    popup.classList.remove("show");
  }, 5000);
}
