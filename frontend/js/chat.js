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

    // username
    const userSpan = document.createElement('span');
    userSpan.className = 'username';
    userSpan.textContent = (window.safeDom && window.safeDom.sanitizeText) ? window.safeDom.sanitizeText(username || '') : (username || '');
    msgElement.appendChild(userSpan);

    // message (preserve newlines safely)
    const messageWrapper = document.createElement('span');
    messageWrapper.className = 'message';
    const safeMessage = (window.safeDom && window.safeDom.sanitizeText) ? window.safeDom.sanitizeText(message || '') : (message || '');
    // convert newlines into <br>
    safeMessage.split(/\r?\n/).forEach((part, idx) => {
        if (idx > 0) messageWrapper.appendChild(document.createElement('br'));
        messageWrapper.appendChild(document.createTextNode(part));
    });
    msgElement.appendChild(messageWrapper);

    // timestamp
    const timeSpan = document.createElement('span');
    timeSpan.className = 'timestamp';
    timeSpan.textContent = formatTimestamp(timestamp);
    msgElement.appendChild(timeSpan);

    chatBox.appendChild(msgElement);
    chatBox.scrollTop = chatBox.scrollHeight;
});

socket.on("update", text => {
    const msgElement = document.createElement("div");
    msgElement.classList.add("chat-message", "other");
    msgElement.style.fontStyle = "italic";
    const span = document.createElement('span');
    span.textContent = (window.safeDom && window.safeDom.sanitizeText) ? window.safeDom.sanitizeText(text || '') : (text || '');
    msgElement.appendChild(span);
    chatBox.appendChild(msgElement);
    chatBox.scrollTop = chatBox.scrollHeight;
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