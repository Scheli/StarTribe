import { verificaAccesso } from "./verificaAccesso.js";

async function init() {
  const result = await verificaAccesso();
  if (result.accesso) {
    document.getElementById("welcome").value = result.message;
  } else {
    alert(result.message);
    window.location.href = "/frontend/html/registrazione.html";
  }
}

window.addEventListener("load", init);
