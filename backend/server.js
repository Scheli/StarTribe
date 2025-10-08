const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const mongoose = require('mongoose');

mongoose.connect('mongodb+srv://databaseprogetto:StarTribe@startribedb.dwlllm5.mongodb.net/', {
    useNewUrlParser: true,
    useUnifiedTopology: true,
}). then(() => {
    console.log('Connesso a MongoDB');
}).catch(err => {
    console.error('Errore di connessione a MongoDB: ',err);
});

const messageSchema = new mongoose.Schema({
    username: String,
    message: String,
    tumestamp: {type: Date, default: Date.now}
});

const Message = mongoose.model('Message', messageSchema);

app.use(express.static('public'))

io.on('connection', (socket) => {
    console.log('Un utente si è connesso');

    Message.find().sort({timestamp: 1}).then(messages => {
        socket.emit('load messages', messages);
    });

    socket.on('chat message', (data) => {
        const {username, message} = data;
        const newMessage = new Message({username, message});

        newMessage.save().then(() => {
        io.emit('chat message', {username, message});
        });
    });

    socket.on('disconnect', () => {
    console.log('Un utente si è disconnesso');
    });
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
    console.log(`Server in ascolto sulla porta ${PORT}`);
});