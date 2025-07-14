export async function verificaAccesso(redirectUrl = "/frontend/html/registrazione.html") {
  const token = localStorage.getItem("token");
  if (!token) {
    alert("Devi essere registrato per accedere.");
    window.location.href = redirectUrl;
    return false;
  }

  try {
    const response = await fetch("http://localhost:8080/api/sicuro", {
      headers: { Authorization: "Bearer " + token },
    });

    if (response.ok) {
      const data = await response.json();
      return data.message;
    } else {
      alert("Token non valido o scaduto, effettua il login.");
      localStorage.removeItem("token");
      window.location.href = redirectUrl;
      return false;
    }
  } catch (error) {
    alert("Errore di connessione, riprova.");
    return false;
  }
}
