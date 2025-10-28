import { verificaAccesso } from "./verificaAccesso.js";

async function init() {
  const result = await verificaAccesso();
  const welcomeEl = document.getElementById("welcome");
  
  if (result.accesso) {
    if (welcomeEl) welcomeEl.textContent = result.message;
  } else {
    alert(result.message);
    window.location.href = "/frontend/html/registrazione.html";
  }
}

window.addEventListener("load", init);
