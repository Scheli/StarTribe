/* const form = document.getElementById("registerForm");
const message = document.getElementById("message");

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const username = form.username.value.trim();
  const email = form.email.value.trim();
  const password = form.password.value.trim();
  const birthdate = form.birthdate.value;

  if (!username || !email || !password || !birthdate) {
    message.textContent = "Compila tutti i campi.";
    message.style.color = "red";
    return;
  }

  try {
    const response = await fetch("http://localhost:8080/api/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, email, password, birthdate }),
    });

    const data = await response.json();

    if (response.ok) {
      message.textContent = "Registrazione avvenuta con successo!";
      message.style.color = "green";

      if (data.token) {
        localStorage.setItem("token", data.token);
      }

      form.reset();
    } else {
      message.textContent = data.message || "Errore nella registrazione.";
      message.style.color = "red";
    }
  } catch (error) {
    console.error("Errore di rete:", error);
    message.textContent = "Errore di connessione al server.";
    message.style.color = "red";
  }
});
 */

const form = document.getElementById("registerForm");
const message = document.getElementById("message");

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const username = form.username.value.trim();
  const email = form.email.value.trim();
  const password = form.password.value.trim();
  const birthdate = form.birthdate.value; // aggiunto

  if (!username || !email || !password || !birthdate) {
    message.textContent = "Compila tutti i campi.";
    message.style.color = "red";
    return;
  }

  try {
    const response = await fetch("http://localhost:8080/api/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, email, password, birthdate }),
    });

    const data = await response.json();

    if (response.ok) {
      message.textContent = "Registrazione avvenuta con successo!";
      message.style.color = "green";

      if (data.token) localStorage.setItem("token", data.token);

      form.reset();
    } else {
      message.textContent = data.message || "Errore nella registrazione.";
      message.style.color = "red";
    }
  } catch (error) {
    console.error("Errore di rete:", error);
    message.textContent = "Errore di connessione al server.";
    message.style.color = "red";
  }
});

// Checkbox abilita/disabilita submit
document.getElementById("terms").addEventListener("change", function () {
  document.getElementById("send-form").disabled = !this.checked;
});

// Rimuove error-input al click
const inputs = document.querySelectorAll("input");
inputs.forEach((input) => {
  input.addEventListener("click", function () {
    inputs.forEach((i) => i.classList.remove("error-input"));
  });
});
