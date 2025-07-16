const express = require("express");
const path = require("path");

const app = express();
const server = require("http").createServer(app);

io.on("Connection ", function(socket){

    socket.on("newuser", function(username){
        socket.broadcast.emit("update",username + " è entrato nella chat");
    });
    socket.on("exituser", function(username){
        socket.broadcast.emit("update",username + " è uscito dalla chat");
    });
   socket.on("chat", function(message){
        socket.broadcast.emit("chat",message);
    });
})

app.use(express.static(path.join(__dirname+"/public")));

server.listen(5000);