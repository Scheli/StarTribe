/* const form = document.getElementById("loginForm");
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
        window.location.href = "/frontend/html/profilo.html";
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
 */


const form = document.getElementById("loginForm");
const message = document.getElementById("message");
const sendBtn = document.getElementById("send-form");
const checkbox = document.getElementById("consents"); // se vuoi usare la checkbox

// Funzione per mostrare il popup
function showPopup(messageText, isError = false) {
    const popup = document.createElement("div");
    popup.className = "popup-message";
    popup.textContent = messageText;
    popup.style.background = isError ? "rgba(255,0,0,0.8)" : "rgba(128,0,255,0.8)";
    popup.style.color = "white";
    popup.style.position = "fixed";
    popup.style.top = "20px";
    popup.style.left = "50%";
    popup.style.transform = "translateX(-50%)";
    popup.style.padding = "15px 25px";
    popup.style.borderRadius = "8px";
    popup.style.zIndex = "2000";
    popup.style.boxShadow = "0 0 10px #00000066";
    popup.style.opacity = "0";
    popup.style.transition = "opacity 0.4s ease, transform 0.4s ease";

    document.body.appendChild(popup);

    // Animazione di comparsa
    setTimeout(() => {
        popup.style.opacity = "1";
        popup.style.transform = "translateX(-50%) translateY(0)";
    }, 50);

    // Nascondi dopo 3 secondi
    setTimeout(() => {
        popup.style.opacity = "0";
        popup.style.transform = "translateX(-50%) translateY(-20px)";
        setTimeout(() => document.body.removeChild(popup), 400);
    }, 3000);
}

// Abilita/disabilita il bottone se usi la checkbox
if (checkbox) {
    sendBtn.disabled = !checkbox.checked;
    checkbox.addEventListener("change", () => {
        sendBtn.disabled = !checkbox.checked;
    });
}

// Validazione e invio form
form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const email = form.email.value.trim();
    const password = form.password.value.trim();

    if (!email || !password) {
        showPopup("Compila tutti i campi.", true);
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
            showPopup("Login effettuato con successo!");
            if (data.token) {
                localStorage.setItem("token", data.token);
                setTimeout(() => window.location.href = "/frontend/html/profilo.html", 1200);
            }
            form.reset();
        } else {
            showPopup(data.message || "Errore nel login.", true);
        }
    } catch (error) {
        console.error("Errore di rete:", error);
        showPopup("Errore di connessione al server.", true);
    }
});

// Rimuove la classe di errore quando clicchi sugli input
const inputs = document.querySelectorAll("input");
inputs.forEach(input => {
    input.addEventListener("click", function () {
        inputs.forEach(i => i.classList.remove("error-input"));
    });
});
