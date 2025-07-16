// backend/models/utente.js

const mongoose = require("mongoose");

const utenteSchema = new mongoose.Schema({
  username: String,
  email: String,
  password: String,
  birthdate: Date,
  immagineProfilo: { type: String, default: null },     // ✅ link cloudinary
  tipoMediaProfilo: { type: String, default: "immagine" }, // ✅ immagine o video
  punti: { type: Number, default: 0 }
});

module.exports = mongoose.model("Utente", utenteSchema);
