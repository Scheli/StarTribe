// Connetti subito a Socket.io (auto usa stessa origin)
const socket = io();

// Elementi DOM
const loginPane = document.getElementById("loginPane");
const loginForm = document.getElementById("loginForm");
const usernameInput = document.getElementById("usernameInput");

const chatPane = document.getElementById("chatPane");
const currentUserEl = document.getElementById("currentUser");
const userListEl = document.getElementById("userList");
const messagesEl = document.getElementById("messages");
const messageForm = document.getElementById("messageForm");
const messageInput = document.getElementById("messageInput");

let currentUsername = null;

function showChat(username) {
  currentUsername = username;
  currentUserEl.textContent = `Tu: ${username}`;
  loginPane.hidden = true;
  chatPane.hidden = false;
}

function addMessage({ username, message, timestamp }, isMe = false) {
  const li = document.createElement("li");
  li.className = `message ${isMe ? "me" : "other"}`;
  const timeStr = new Date(timestamp).toLocaleTimeString();
  li.innerHTML = `<strong>${username}</strong> <small>${timeStr}</small><br>${escapeHtml(message)}`;
  messagesEl.appendChild(li);
  scrollMessagesToBottom();
}

function addSystemMessage(type, username, timestamp) {
  const li = document.createElement("li");
  li.className = "message system";
  const timeStr = new Date(timestamp).toLocaleTimeString();
  if (type === "join") {
    li.textContent = `${username} è entrato in chat (${timeStr})`;
  } else if (type === "leave") {
    li.textContent = `${username} ha lasciato la chat (${timeStr})`;
  } else {
    li.textContent = `[${timeStr}] ${username}`;
  }
  messagesEl.appendChild(li);
  scrollMessagesToBottom();
}

function updateUserList(list) {
  userListEl.innerHTML = "";
  list.forEach(u => {
    const li = document.createElement("li");
    li.textContent = u;
    userListEl.appendChild(li);
  });
}

function scrollMessagesToBottom() {
  // contenitore scorrevole è il parent (.messages) → oppure usare scrollIntoView
  messagesEl.lastElementChild?.scrollIntoView({ behavior: "smooth", block: "end" });
}

// Piccola funzione per evitare injection HTML
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// Gestione submit login
loginForm.addEventListener("submit", e => {
  e.preventDefault();
  const username = usernameInput.value.trim() || "Anonimo";
  showChat(username);
  socket.emit("join", username);
});

// Gestione invio messaggi
messageForm.addEventListener("submit", e => {
  e.preventDefault();
  const text = messageInput.value.trim();
  if (!text) return;
  socket.emit("chat-message", text);
  // Visualizza subito messaggio "mio" (optimistic UI) oppure attendi eco dal server.
  // Qui aspettiamo eco per avere timestamp server-sincronizzato.
  messageInput.value = "";
  messageInput.focus();
});

// Ricezione messaggio chat
socket.on("chat-message", payload => {
  const isMe = payload.username === currentUsername;
  addMessage(payload, isMe);
});

// Ricezione messaggi sistema (join/leave)
socket.on("system-message", payload => {
  addSystemMessage(payload.type, payload.username, payload.timestamp);
});

// Ricezione elenco utenti
socket.on("user-list", list => {
  updateUserList(list);
});

// Se il server si riconnette/connessione persa
socket.io.on("reconnect", () => {
  if (currentUsername) {
    socket.emit("join", currentUsername);
  }
});