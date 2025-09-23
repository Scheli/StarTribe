const token = localStorage.getItem("token") || prompt("Inserisci il tuo token JWT");
if(!token) {
    alert("Token JWT mancante. Effettua il login per poter accedere alla chat");
    throw new Error("Token mancante");
}

const socket = io("http://localhost:8080", {
    auth: {token}
});

const chatBox = document.getElementById("chat");
const form = document.getElementById("form");
const input = document.getElementById("messageInput");
const usernameDisplay = document.getElementById("usernameDisplay");

let currentUser = "Tu";

socket.on("connect", () => {
    console.log("Connesso al server con ID:", socket.id);
    usernameDisplay.textContent = "Tu";
});

socket.on("chat", data => {
    const { username, message, timestamp } = data;
    const msgElement = document.createElement("div");
    msgElement.classList.add("chat-message");
    msgElement.classList.add(username === currentUser ? "me" : "other");

    msgElement.innerHTML = `
        <span class="username">${username}</span>
        ${message}
        <span class="timestamp">${formatTimestamp(timestamp)}</span>
    `;

    chatBox.appendChild(msgElement);
    chatBox.scrollTop = chatBox.scrollHeight;
});

socket.on("update", text => {
    const msgElement = document.createElement("div");
    msgElement.classList.add("chat-message", "other");
    msgElement.style.fontStyle = "italic";
    msgElement.innerHTML = `<span>${text}</span>`
    chatBox.appendChild(msgElement);
    chatBox.scrollTop = chat.scrollHeight;
});

form.addEventListener("submit", (e) => {
    e.preventDefault();

    const message = input.value.trim();
    if (message) {
        socket.emit("chat", message);
        input.value="";
    }
});

function formatTimestamp(iso) {
    const date = new Date(iso);
    return date.toLocaleTimeString("it-IT", {
        hour: "2-digit",
        minute: "2-digit"
    });
}