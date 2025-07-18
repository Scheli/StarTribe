// backend/routes/uploadRoute.js

const express = require("express");
const router = express.Router();
const multer = require("multer");
const { storage } = require("../utils/cloudinary");
const upload = multer({ storage });
const Utente = require("../models/utente"); // Usa il tuo schema

// Endpoint: POST /api/upload/:idUtente
router.post("/upload/:idUtente", upload.single("file"), async (req, res) => {
  try {
    const { idUtente } = req.params;

    if (!req.file || !req.file.path) {
      return res.status(400).json({ errore: "Nessun file ricevuto" });
    }

    const url = req.file.path;
    const tipo = req.file.mimetype.startsWith("video") ? "video" : "immagine";

    const utenteAggiornato = await Utente.findByIdAndUpdate(
      idUtente,
      {
        immagineProfilo: url,
        tipoMediaProfilo: tipo,
      },
      { new: true }
    );

    if (!utenteAggiornato) {
      return res.status(404).json({ errore: "Utente non trovato" });
    }

    res.status(200).json({
      messaggio: "Upload riuscito!",
      url,
      tipo,
    });
  } catch (err) {
    console.error("Errore upload:", err);
    res.status(500).json({ errore: "Errore durante l'upload" });
  }
});

module.exports = router;
