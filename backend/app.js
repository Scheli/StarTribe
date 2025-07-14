import express from "express";
import cors from "cors";
import { connectToDB, aggiungiUtente } from "./db.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const JWT_SECRET = process.env.JWT_SECRET || "secret123";

let db;

app.post("/api/register", async (req, res) => {
  const { username, email, password, birthdate } = req.body;

  if (!username || !email || !password || !birthdate) {
    return res.status(400).json({ success: false, message: "Tutti i campi sono obbligatori" });
  }

  try {
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    const nuovoUtente = {
      username,
      email,
      password: hashedPassword,
      birthdate,
      immagineProfilo: "",
      punti: 0,
    };

    const id = await aggiungiUtente(nuovoUtente);
    if (!id) {
      return res.status(409).json({ success: false, message: "Email già registrata" });
    }

    const token = jwt.sign(
      { userId: id.toString(), username },
      JWT_SECRET,
      { expiresIn: "1h" }
    );

    res.status(201).json({ success: true, message: "Registrazione avvenuta", token });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Errore interno del server" });
  }
});

app.get("/api/sicuro", (req, res) => {
  const authHeader = req.headers.authorization;

  if (!authHeader) return res.status(401).json({ message: "Token mancante" });

  const token = authHeader.split(" ")[1];
  if (!token) return res.status(401).json({ message: "Token mancante" });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    res.json({ message: `Benvenuto ${decoded.username}!` });
  } catch (err) {
    return res.status(401).json({ message: "Token non valido o scaduto" });
  }
});

app.listen(8080, async () => {
  try {
    db = await connectToDB();
    console.log("✅ Server avviato su http://localhost:8080 e connesso al DB");
  } catch (e) {
    console.error("❌ Errore durante la connessione al DB:", e);
  }
});
