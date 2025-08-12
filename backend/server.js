import path from "path";
import express from "express";
import http from "http";
import cors from "cors";
import { Server } from "socket.io";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());

// Percorso alla cartella frontend (static files)
const FRONTEND_DIR = path.join(__dirname, "..", "frontend");
app.use(express.static(FRONTEND_DIR));

// Se qualcuno va su /, reindirizziamo alla pagina chat
app.get("/", (req, res) => {
  res.sendFile(path.join(FRONTEND_DIR, "html", "chat.html"));
});

// Creiamo server HTTP e istanza Socket.io
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*", // per ambiente scolastico / locale
    methods: ["GET", "POST"]
  }
});

// Mappa per tenere traccia degli utenti
// key: socket.id, value: { username }
const users = new Map();

function broadcastUserList() {
  const list = Array.from(users.values()).map(u => u.username);
  io.emit("user-list", list);
}

io.on("connection", socket => {
  console.log("Nuova connessione:", socket.id);

  // Il client invia lo username dopo la connessione
  socket.on("join", username => {
    if (typeof username !== "string" || !username.trim()) {
      username = "Anonimo";
    }
    username = username.trim();
    users.set(socket.id, { username });
    console.log(`${username} si è unito alla chat`);

    // Notifica tutti che l'utente è entrato
    io.emit("system-message", {
      type: "join",
      username,
      timestamp: Date.now()
    });

    // Aggiorna elenco utenti a tutti
    broadcastUserList();
  });

  // Messaggio chat
  socket.on("chat-message", msgText => {
    const entry = users.get(socket.id);
    if (!entry) return; // utente non registrato
    const payload = {
      username: entry.username,
      message: String(msgText || "").slice(0, 2000), // cut lungo
      timestamp: Date.now()
    };
    io.emit("chat-message", payload);
  });

  // Disconnessione
  socket.on("disconnect", reason => {
    const entry = users.get(socket.id);
    if (entry) {
      const username = entry.username;
      users.delete(socket.id);
      console.log(`${username} ha lasciato la chat (${reason})`);
      io.emit("system-message", {
        type: "leave",
        username,
        timestamp: Date.now()
      });
      broadcastUserList();
    } else {
      console.log(`Socket ${socket.id} disconnesso senza username (${reason})`);
    }
  });
});

// Avvio server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server chat avviato su http://localhost:${PORT}`);
});