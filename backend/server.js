import express from 'express';
import http from 'http';
import mongoose from 'mongoose';
import { Server as SocketIO } from 'socket.io';
import cors from 'cors';

const app = express();
const server = http.createServer(app);
const io = new SocketIO(server, { cors: { origin: '*' } });

app.use(cors());
app.use(express.json());

// Connessione MongoDB
mongoose.connect('mongodb+srv://databaseprogetto:StarTribe@startribedb.dwlllm5.mongodb.net/', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

// Schemi mongoose
const UserSchema = new mongoose.Schema({
  username: String,
  // altri campi utente ...
});

const MessageSchema = new mongoose.Schema({
  userId: mongoose.Schema.Types.ObjectId,
  username: String,
  text: String,
  createdAt: { type: Date, default: Date.now },
});

const User = mongoose.model('User', UserSchema);
const Message = mongoose.model('Message', MessageSchema);

// API per ottenere messaggi (esempio)
app.get('/api/messages', async (req, res) => {
  const messages = await Message.find().sort({ createdAt: 1 }).limit(100);
  res.json(messages);
});

// Socket.IO gestione messaggi
io.on('connection', (socket) => {
  console.log('Nuovo client connesso');

  // Quando arriva un messaggio
  socket.on('chatMessage', async ({ userId, username, text }) => {
    const message = new Message({ userId, username, text });
    await message.save();

    // Invia a tutti i client
    io.emit('message', { userId, username, text, createdAt: message.createdAt });
  });

  socket.on('disconnect', () => {
    console.log('Client disconnesso');
  });
});

// Server in ascolto
server.listen(3000, () => {
  console.log('Server in ascolto sulla porta 3000');
});