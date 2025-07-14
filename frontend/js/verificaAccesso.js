export async function verificaAccesso(redirectUrl = "/frontend/html/registrazione.html") {
  const token = localStorage.getItem("token");
  if (!token) {
    return { accesso: false, message: "Devi essere registrato per accedere." };
  }

  try {
    const response = await fetch("http://localhost:8080/api/sicuro", {
      headers: { Authorization: "Bearer " + token },
    });

    if (response.ok) {
      const data = await response.json();
      return { accesso: true, message: data.message };
    } else {
      localStorage.removeItem("token");
      return { accesso: false, message: "Token non valido o scaduto, effettua il login." };
    }
  } catch (error) {
    return { accesso: false, message: "Errore di connessione, riprova." };
  }
}
