const form = document.getElementById("loginForm");
const message = document.getElementById("message");

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const email = form.email.value.trim();
  const password = form.password.value.trim();

  if (!email || !password) {
    message.textContent = "Compila tutti i campi.";
    message.style.color = "red";
    return;
  }

  try {
    const response = await fetch("http://localhost:8080/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    const data = await response.json();

    if (response.ok) {
      message.textContent = "Login effettuato con successo!";
      message.style.color = "green";

      if (data.token) {
        localStorage.setItem("token", data.token);
        window.location.href = "/frontend/html/sicuro.html";
      }

    } else {
      message.textContent = data.message || "Errore nel login.";
      message.style.color = "red";
    }
  } catch (error) {
    console.error("Errore di rete:", error);
    message.textContent = "Errore di connessione al server.";
    message.style.color = "red";
  }
});
