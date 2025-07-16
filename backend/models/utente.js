// backend/models/utente.js

const mongoose = require("mongoose");

const utenteSchema = new mongoose.Schema({
  username: String,
  email: String,
  password: String,
  birthdate: Date,
  immagineProfilo: { type: String, default: null },
  tipoMediaProfilo: { type: String, default: "immagine" },
  bannerProfilo: { type: String, default: null },       
  punti: { type: Number, default: 0 }
});

module.exports = mongoose.model("Utente", utenteSchema);
