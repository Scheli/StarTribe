  import "dotenv/config";
  import express from "express";
  import cors from "cors";
  import { connectToDB, aggiungiUtente, GetUtentiConsigliati } from "./db.js";
  import { getAPOD, getInSightWeather} from "./apirequest.js";
  import bcrypt from "bcrypt";
  import jwt from "jsonwebtoken";
  import { MILESTONES, TIERS, unlockedBorders, computeProgress } from "./trophy.js";
  import multer from "multer";
  import { storage, cloudinary } from "./utils/cloudinary.js";
  import { ObjectId } from "mongodb";
  import { createServer } from "http";
  import {Server} from "socket.io";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CARDS_DIR = path.resolve(__dirname, "../frontend/assets/card");

let CARD_FILES = [];
try {
  CARD_FILES = fs.readdirSync(CARDS_DIR)
    .filter(f => /\.(png|jpe?g|gif|webp|svg)$/i.test(f));
} catch (err) {
  console.error("[cards] impossibile leggere la cartella:", err);
}

function pickRandomCard() {
  if (!CARD_FILES.length) return null;
  const i = Math.floor(Math.random() * CARD_FILES.length);
  return `/frontend/assets/card/${CARD_FILES[i]}`;
}

  const app = express();
  const PORT = process.env.PORT || 8080;
  const httpServer = createServer(app);
  app.use(cors());
  app.use(express.json());
  app.use("/frontend", express.static(path.resolve(__dirname, "../frontend")));


  const JWT_SECRET = process.env.JWT_SECRET || "secret123";
  const upload = multer({ storage });

const io = new Server(httpServer, {
  cors: {
    origin: "*",
    method: ["GET", "POST"]
  }
});
httpServer.listen(PORT, () => {
  console.log(`Server avviato su http://localhost:${PORT}`);
})

/*===Autenticazione con JWT===*/

io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  if(!token) {
    return next(new Error("Token mancante"));
  }
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    socket.user = decoded;
    return next();
  } catch (err) {
    console.error("Errore autenticazione socket: ", err);
    return next(new Error("Token non valido"));
  }
});

/*===Server per backend chat===*/

const utentiConnessi = new Map();

  io.on("connection", socket => {
    const username = socket.user?.username || "Utente";

    utentiConnessi.set(socket.id, username);
    socket.broadcast.emit("update", `${username} è entrato in chat`);

    socket.on("chat", msg => {
      io.emit("chat", {
        username,
        message: msg,
        timestamp: new Date().toISOString(),
      });
    });

    socket.on("disconnect", ()=>{
        socket.broadcast.emit("update", `${username} ha lasciato la chat`);
        utentiConnessi.delete(socket.id);
    })
  });


/*===Sicurezza e Profilo Utente===*/

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
          tipoMediaProfilo: "",
          punti: 0,
          tickets: 0,         
          cards: []           
        };
      const id = await aggiungiUtente(nuovoUtente);
      if (!id) {
        return res.status(409).json({ success: false, message: "Email già registrata" });
      }

      const token = jwt.sign({ userId: id.toString(), username }, JWT_SECRET, { expiresIn: "1h" });

      res.status(201).json({ success: true, message: "Registrazione avvenuta", token });
    } catch (err) {
      console.error(err);
      res.status(500).json({ success: false, message: "Errore interno del server" });
    }
  });

  app.post("/api/login", async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: "Email e password sono obbligatori" });
    }

    try {
      const db = await connectToDB();
      const user = await db.collection("utenti").findOne({ email });

      if (!user) {
        return res.status(401).json({ success: false, message: "Credenziali non valide" });
      }

      const passwordValida = await bcrypt.compare(password, user.password);
      if (!passwordValida) {
        return res.status(401).json({ success: false, message: "Credenziali non valide" });
      }

      const token = jwt.sign(
        { userId: user._id.toString(), username: user.username },
        JWT_SECRET,
        { expiresIn: "1h" }
      );

      res.json({ success: true, message: "Login effettuato", token });
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

 /*===Gestione Decorazioni Profilo===*/

  app.get("/api/trophy", async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ success: false, message: "Token mancante" });

    try {
      const token = authHeader.split(" ")[1];
      const decoded = jwt.verify(token, JWT_SECRET);

      const db = await connectToDB();
      const utenti = db.collection("utenti");

      const user = await utenti.findOne({ _id: new ObjectId(decoded.userId) });
      if (!user) return res.status(404).json({ success: false, message: "Utente non trovato" });

      const points         = user.punti || 0;
      const claimed        = Array.isArray(user.claimedMilestones) ? user.claimedMilestones : [];
      const selectedBorder = user.selectedBorder || "none";
      const tickets        = user.tickets || 0;

      const milestones = MILESTONES.map(m => {
        const status = claimed.includes(m.id)
          ? "claimed"
          : (points >= m.points ? "claimable" : "locked");
        return { id: m.id, type: m.type, payload: m.payload, points: m.points, status };
      });

      const progress = computeProgress(points);

      const unlockedByClaim = claimed
        .map(mId => {
          const m = MILESTONES.find(mm => mm.id === mId && mm.type === "tier");
          return m ? m.payload.borderKey : null;
        })
        .filter(Boolean);

      const claimableBorders = MILESTONES
        .filter(m => m.type === "tier" && points >= m.points && !claimed.includes(m.id))
        .map(m => m.payload.borderKey);

      res.json({
        success: true,
        unlockedBorders: unlockedByClaim,
        points,
        tickets,
        selectedBorder,
        milestones,
        progress,
        tiers: TIERS,
        claimableBorders
      });
    } catch (err) {
      console.error("GET /api/trophy error:", err);
      res.status(401).json({ success: false, message: "Token non valido o scaduto" });
    }
  });

  app.put("/api/trophy/select", async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ success: false, message: "Token mancante" });

    try {
      const token = authHeader.split(" ")[1];
      const decoded = jwt.verify(token, JWT_SECRET);
      const { borderKey, borderUrl } = req.body;

      if (!borderKey) return res.status(400).json({ success: false, message: "borderKey mancante" });

      const db = await connectToDB();
      const user = await db.collection("utenti").findOne({ _id: new ObjectId(decoded.userId) });
      if (!user) return res.status(404).json({ success: false, message: "Utente non trovato" });

      const points = user.punti || 0;
      const unlocked = unlockedBorders(points);
      if (!unlocked.includes(borderKey)) {
        return res.status(403).json({ success: false, message: "Cornice non sbloccata" });
      }

      const valueToSave = borderUrl && /^https?:\/\//i.test(borderUrl) ? borderUrl : borderKey;

      await db.collection("utenti").updateOne(
        { _id: new ObjectId(decoded.userId) },
        { $set: { selectedBorder: valueToSave } }
      );

      res.json({ success: true, message: "Cornice selezionata", selectedBorder: valueToSave });
    } catch (e) {
      console.error("PUT /api/trophy/select", e);
      res.status(401).json({ success: false, message: "Token non valido o scaduto" });
    }
  });

  app.post("/api/trophy/claim", async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ success: false, message: "Token mancante" });

    try {
      const token = authHeader.split(" ")[1];
      const decoded = jwt.verify(token, JWT_SECRET);
      const { milestoneId } = req.body;
      if (!milestoneId) return res.status(400).json({ success: false, message: "milestoneId mancante" });

      const milestone = MILESTONES.find(m => m.id === milestoneId);
      if (!milestone) return res.status(404).json({ success: false, message: "Milestone inesistente" });

      const db = await connectToDB();
      const utenti = db.collection("utenti");
      const user = await utenti.findOne({ _id: new ObjectId(decoded.userId) });
      if (!user) return res.status(404).json({ success: false, message: "Utente non trovato" });

      const points = user.punti || 0;
      const claimed = user.claimedMilestones || [];
      if (claimed.includes(milestoneId)) {
        return res.json({ success: true, message: "Già riscattata", tickets: user.tickets || 0 });
      }
      if (points < milestone.points) {
        return res.status(403).json({ success: false, message: "Non hai ancora i punti per questa milestone" });
      }

      let tickets = user.tickets || 0;
      const setOps = {};
      if (milestone.type === "ticket") {
        tickets += milestone.payload.amount;
        setOps.tickets = tickets;
      }

      await utenti.updateOne(
        { _id: new ObjectId(decoded.userId) },
        { $set: setOps, $addToSet: { claimedMilestones: milestoneId } }
      );

      res.json({ success: true, message: "Ricompensa riscattata", tickets });
    } catch (e) {
      console.error(e);
      res.status(401).json({ success: false, message: "Token non valido o scaduto" });
    }
  });

/*===Funzione Follow===*/

  app.post("/api/segui", async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ success: false, message: "Token mancante" });
    }

    const token = authHeader.split(" ")[1];
    const { utenteDaSeguireId } = req.body;

    if (!utenteDaSeguireId) {
      return res.status(400).json({ success: false, message: "ID utente da seguire mancante" });
    }

    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      const mioId = decoded.userId;

      if (mioId === utenteDaSeguireId) {
        return res.status(400).json({ success: false, message: "Non puoi seguire te stesso" });
      }

      const db = await connectToDB();
      const utenti = db.collection("utenti");

      const utenteTarget = await utenti.findOne({ _id: new ObjectId(utenteDaSeguireId) });
      if (!utenteTarget) {
        return res.status(404).json({ success: false, message: "Utente da seguire non trovato" });
      }

      await utenti.updateOne(
        { _id: new ObjectId(mioId) },
        { $addToSet: { seguiti: new ObjectId(utenteDaSeguireId) } }
      );

      await utenti.updateOne(
        { _id: new ObjectId(utenteDaSeguireId) },
        { $addToSet: { follower: new ObjectId(mioId) } }
      );

      res.json({ success: true, message: "Utente seguito con successo" });
    } catch (err) {
      console.error("Errore nel seguire l'utente:", err);
      res.status(401).json({ success: false, message: "Token non valido o errore interno" });
    }
  });

/*Funzione Unfollow*/

  app.post("/api/unfollow", async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ success: false, message: "Token mancante" });

    const token = authHeader.split(" ")[1];
    const { utenteDaSmettereId } = req.body;

    if (!utenteDaSmettereId) {
      return res.status(400).json({ success: false, message: "ID utente da smettere di seguire mancante" });
    }

    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      const mioId = decoded.userId;

      if (mioId === utenteDaSmettereId) {
        return res.status(400).json({ success: false, message: "Non puoi smettere di seguire te stesso" });
      }

      const db = await connectToDB();
      const utenti = db.collection("utenti");

      await utenti.updateOne(
        { _id: new ObjectId(mioId) },
        { $pull: { seguiti: new ObjectId(utenteDaSmettereId) } }
      );

      await utenti.updateOne(
        { _id: new ObjectId(utenteDaSmettereId) },
        { $pull: { follower: new ObjectId(mioId) } }
      );

      res.json({ success: true, message: "Hai smesso di seguire l'utente" });
    } catch (err) {
      console.error("Errore durante unfollow:", err);
      res.status(401).json({ success: false, message: "Token non valido o errore interno" });
    }
  });

  /*===Gestione del profilo===*/

  app.get("/api/profilo", async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ success: false, message: "Token mancante" });
  }

  const token = authHeader.split(" ")[1];
  try {

    const decoded = jwt.verify(token, JWT_SECRET);
    const dbLocal = await connectToDB();

    const utente = await dbLocal.collection("utenti").findOne({ _id: new ObjectId(decoded.userId) });
    if (!utente) {
      return res.status(404).json({ success: false, message: "Utente non trovato" });
    }

    const articoli = await dbLocal.collection("articoli")
      .find({ userId: decoded.userId })
      .sort({ createdAt: -1 })
      .toArray();

    const postsFormatted = articoli.map(post => ({
      _id: post._id.toString(),
      titolo: post.titolo,
      descrizione: post.descrizione,
      ImmaginePost: post.ImmaginePost || "",
      TipoImmaginePost: post.TipoImmaginePost || "",
      createdAt: post.createdAt ? new Date(post.createdAt).toLocaleDateString("it-IT") : "",
    }));

    res.json({
      success: true,
      utente: {
        _id: utente._id.toString(),
        username: utente.username,
        email: utente.email,
        birthdate: utente.birthdate,
        punti: utente.punti,
        immagineProfilo: utente.immagineProfilo,
        bannerProfilo: utente.bannerProfilo || "",
        selectedBorder: utente.selectedBorder || "none",
        pfpfinal: utente.pfpfinal || "",
        seguiti: (utente.seguiti || []).map(id => id.toString()),
        follower: (utente.follower || []).map(id => id.toString()),
        tickets: utente.tickets || 0,
        cards: utente.cards || [],
        posts: postsFormatted
      }
    });

  } catch (err) {
    console.error("Errore JWT /api/profilo:", err);
    res.status(403).json({ success: false, message: "Token non valido" });
  }
});

/*===Post sul profilo dell'utente===*/

app.get("/api/posts/utente/:id", async (req, res) => {
  const userId = req.params.id;
  try {
    const dbLocal = await connectToDB();
    const articoli = await dbLocal.collection("articoli")
      .find({ userId: userId })
      .sort({ createdAt: -1 })
      .toArray();

    const postsFormatted = articoli.map(post => ({
      _id: post._id.toString(),
      titolo: post.titolo,
      descrizione: post.descrizione,
      ImmaginePost: post.ImmaginePost || "",
      TipoImmaginePost: post.TipoImmaginePost || "",
      createdAt: post.createdAt ? new Date(post.createdAt).toLocaleDateString("it-IT") : "",
    }));

    res.json({ success: true, posts: postsFormatted });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Errore server" });
  }
});

/*===Modifica Profilo===*/

  app.put("/api/profilo/update", async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ success: false, message: "Token mancante" });

    const token = authHeader.split(" ")[1];
    if (!token) return res.status(401).json({ success: false, message: "Token mancante" });

    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      const userId = decoded.userId;

      const { username, birthdate } = req.body;
      if (!username || !birthdate) {
        return res.status(400).json({ success: false, message: "Username e data di nascita sono obbligatori" });
      }

      const db = await connectToDB();
      const result = await db.collection("utenti").updateOne(
        { _id: new ObjectId(userId) },
        { $set: { username, birthdate } }
      );

      if (result.modifiedCount === 0) {
        return res.status(404).json({ success: false, message: "Utente non trovato o dati identici" });
      }

      res.json({ success: true, message: "Profilo aggiornato con successo" });
    } catch (err) {
      console.error("Errore aggiornamento profilo:", err);
      return res.status(401).json({ success: false, message: "Token non valido o scaduto" });
    }
  });

/*===Funzione per caricamento Media dall'utente===*/

  app.post("/api/upload", upload.single("file"), async (req, res) => {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({ success: false, message: "Token mancante" });
    }

    const token = authHeader.split(" ")[1];
    if (!token) {
      return res.status(401).json({ success: false, message: "Token mancante" });
    }

    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      const userId = decoded.userId;

      if (!req.file || !req.file.path) {
        return res.status(400).json({ success: false, message: "Nessun file ricevuto" });
      }

      const url = req.file.path;
      const tipo = req.file.mimetype.startsWith("video") ? "video" : "immagine";

      const db = await connectToDB();
      const risultato = await db.collection("utenti").updateOne(
        { _id: new ObjectId(userId) },
        { $set: { immagineProfilo: url, tipoMediaProfilo: tipo } }
      );

      if (risultato.modifiedCount === 0) {
        return res.status(404).json({ success: false, message: "Utente non trovato" });
      }

      res.json({ success: true, message: "File caricato e assegnato all'utente!", url, tipo });
    } catch (err) {
      console.error("Errore upload:", err);
      res.status(401).json({ success: false, message: "Token non valido o scaduto" });
    }
  });

  app.post("/api/upload/banner", upload.single("file"), async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ success: false, message: "Token mancante" });

    const token = authHeader.split(" ")[1];
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      const userId = decoded.userId;

      if (!req.file || !req.file.path) {
        return res.status(400).json({ success: false, message: "Nessun file ricevuto" });
      }

      const url = req.file.path;
      const db = await connectToDB();
      const risultato = await db.collection("utenti").updateOne(
        { _id: new ObjectId(userId) },
        { $set: { bannerProfilo: url } }
      );

      if (risultato.modifiedCount === 0) {
        return res.status(404).json({ success: false, message: "Utente non trovato" });
      }

      res.json({ success: true, message: "Banner aggiornato!", url });
    } catch (err) {
      console.error("Errore upload banner:", err);
      res.status(401).json({ success: false, message: "Token non valido o scaduto" });
    }
  });

  // ---------------- F CICCIO NASA NEWS ----------------

  app.get("/news", async (req, res) => {
    try {
      const db = await connectToDB();
      const utenti = await GetUtentiConsigliati(db);
      res.json(utenti);
    } catch (error) {
      console.error("Errore nella GET /news:", error);
      res.status(500).json({ error: error.message, stack: error.stack });
    }
  });

  app.get("/news/apod", async (req, res) => {
    try {
      const PictureDay = await getAPOD();
      res.json(PictureDay);
    } catch (error) {
      console.error("Errore nella GET di APOD: ", error);
      res.status(500).json({ error: error.message, stack: error.stack });
    }
  });

  app.get("/news/getInSightWeather", async (req, res) => {
    try {
      const Weather = await getInSightWeather();
      res.json(Weather);
    } catch (error) {
      console.log("Errore nella GET di Weather: ", error);
      res.status(500).json({ error: error.message, stack: error.stack });
    }
  });

 app.get("/news/all", async (req, res) => {
  try {
    const apod = await getAPOD();
    const weather = await getInSightWeather();
    const imageLibrary = await searchImageLibrary();

    res.json({ apod, weather, photos, imageLibrary });
  } catch (error) {
    console.error("Errore nella GET /news/all:", error);
    res.status(500).json({ error: error.message, stack: error.stack });
  }
});

app.get("/api/utente/:id", async (req, res) => {
  const id = req.params.id;

  try {
    const db = await connectToDB();
    const utente = await db.collection("utenti").findOne(
      { _id: new ObjectId(id) },
      {
        projection: {
          username: 1,
          punti: 1,
          immagineProfilo: 1,
          bannerProfilo: 1,
          selectedBorder: 1,
          seguiti: 1,
          follower: 1
        }
      }
    );

    if (!utente) {
      return res.status(404).json({ success: false, message: "Utente non trovato" });
    }

    res.json({
      success: true,
      utente: {
        _id: utente._id.toString(),
        username: utente.username,
        punti: utente.punti || 0,
        immagineProfilo: utente.immagineProfilo || "",
        bannerProfilo: utente.bannerProfilo || null,
        selectedBorder: utente.selectedBorder || "none",
        seguiti: (utente.seguiti || []).map(v => v.toString()),
        follower: (utente.follower || []).map(v => v.toString()),
      },
    });
  } catch (err) {
    console.error("Errore:", err);
    res.status(500).json({ success: false, message: "Errore del server" });
  }
});

app.use(express.json());

/*===Caricamento Post===*/

app.post("/api/pubblicapost", upload.single("file"), async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ success: false, message: "Token mancante" });
  }
  const token = authHeader.split(" ")[1];
  if (!token) {
    return res.status(401).json({ success: false, message: "Token mancante" });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const userId = decoded.userId;

    const { titolo, descrizione } = req.body;
    if (!req.file || !titolo || !descrizione) {
      return res.status(400).json({ success: false, message: "Tutti i campi sono obbligatori" });
    }

    const url = req.file.path;  
    const tipo = req.file.mimetype.startsWith("video") ? "video" : "immagine";

    const nuovopost = {
      titolo,
      descrizione,
      ImmaginePost: url,
      TipoImmaginePost: tipo,
      userId,
      createdAt: new Date()
    };

    const db = await connectToDB();
    const risultato = await db.collection("articoli").insertOne(nuovopost);

    res.status(201).json({ success: true, message: "Post creato con successo", postId: risultato.insertedId });

  } catch (err) {
    console.error("Errore upload:", err);
    res.status(401).json({ success: false, message: "Token non valido o scaduto" });
  }
});


// -- GET CARICAMENTO PAGINA POST --
app.get("/api/post", async (req, res) => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({ success: false, message: "Token mancante" });
  }

  const token = authHeader.split(" ")[1];
  if (!token) {
    return res.status(401).json({ success: false, message: "Token mancante" });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const userId = decoded.userId;

    const db = await connectToDB();
    const articoli = db.collection("articoli");
    const utenti = db.collection("utenti");

    const posts = await articoli.find({}).toArray();

    const postsFormatted = await Promise.all(posts.map(async (post) => {
      let autore = null;

      try {
        autore = await utenti.findOne({ _id: new ObjectId(post.userId) });
      } catch (err) {
        console.warn("Utente non trovato per userId:", post.userId);
      }

      return {
        titolo: post.titolo,
        descrizione: post.descrizione,
        ImmaginePost: post.ImmaginePost,
        TipoImmaginePost: post.TipoImmaginePost,
        createdAt: post.createdAt ? new Date(post.createdAt).toLocaleDateString("it-IT") : null,
        autoreNome: autore?.username || "Utente sconosciuto",
        autoreImmagine: autore?.immagineProfilo || null
      };
    }));

    res.json(postsFormatted);

  } catch (err) {
    console.error("Errore nel backend /api/post:", err);
    res.status(500).json({ success: false, message: "Errore del server" });
  }
});

app.get("/api/postutente", async (req, res) => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({ success: false, message: "Token mancante" });
  }

  const token = authHeader.split(" ")[1];
  if (!token) {
    return res.status(401).json({ success: false, message: "Token mancante" });
  }
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const userId = decoded.userId;

    const db = await connectToDB();
    const articoli = db.collection("articoli");

    const posts = await articoli
      .find({ userId: userId }) 
      .sort({ createdAt: -1 })
      .toArray();

    res.json({ success: true, posts });
  } catch (err) {
    console.error("Errore JWT /api/postutente:", err);
    res.status(403).json({ success: false, message: "Token non valido" });
  }
});


/*===Gestione Pescata Carte===*/

app.post("/api/cards/draw", async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ success: false, message: "Token mancante" });

  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const db = await connectToDB();
    const utenti = db.collection("utenti");

    const user = await utenti.findOne(
      { _id: new ObjectId(decoded.userId) },
      { projection: { tickets: 1 } }
    );
    if (!user) return res.status(404).json({ success: false, message: "Utente non trovato" });

    const currentTickets = user.tickets || 0;
    if (currentTickets <= 0) {
      return res.status(400).json({ success: false, message: "Non hai biglietti disponibili" });
    }

    const cardUrl = pickRandomCard();
    if (!cardUrl) {
      return res.status(500).json({ success: false, message: "Nessuna carta disponibile sul server" });
    }
    const update = await utenti.updateOne(
      { _id: new ObjectId(decoded.userId) },
      {
        $inc: { tickets: -1 },
        $addToSet: { cards: cardUrl }
      }
    );

    if (update.modifiedCount === 0) {
      return res.status(500).json({ success: false, message: "Impossibile aggiornare l'utente" });
    }

    return res.json({
      success: true,
      message: "Carta pescata!",
      card: cardUrl,
      tickets: currentTickets - 1
    });
  } catch (err) {
    console.error("POST /api/cards/draw", err);
    return res.status(401).json({ success: false, message: "Token non valido o scaduto" });
  }
});

// gestione like
    

app.post("/api/like", async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ success: false, message: "Token mancante" });
  }

  const token = authHeader.split(" ")[1];
  const { postId } = req.body;

  if (!postId) {
    return res.status(400).json({ success: false, message: "ID del post mancante" });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const mioId = decoded.userId;

    const db = await connectToDB();
    const posts = db.collection("posts");
    const users = db.collection("users");

    const post = await posts.findOne({ _id: new ObjectId(postId) });
    if (!post) {
      return res.status(404).json({ success: false, message: "Post non trovato" });
    }

    // Aggiunge l’ID dell’utente ai like solo se non è già presente
    const result = await posts.updateOne(
      { _id: new ObjectId(postId) },
      { $addToSet: { likes: new ObjectId(mioId) } }
    );

    // Se l'update ha effettivamente aggiunto un nuovo like (non era già presente)
    if (result.modifiedCount > 0) {
      // Incrementa i punti dell'autore del post di 100
      await users.updateOne(
        { _id: new ObjectId(post.userId) },
        { $inc: { punti: 100 } }
      );
    }

    res.json({ success: true, message: "Like aggiunto con successo" });
  } catch (err) {
    console.error("Errore nel mettere like:", err);
    res.status(401).json({ success: false, message: "Token non valido o errore interno" });
  }
});

app.post("/api/unlike", async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ success: false, message: "Token mancante" });
  }

  const token = authHeader.split(" ")[1];
  const { postId } = req.body;

  if (!postId) {
    return res.status(400).json({ success: false, message: "ID del post mancante" });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const mioId = decoded.userId;

    const db = await connectToDB();
    const posts = db.collection("posts");
    const users = db.collection("users");

    const post = await posts.findOne({ _id: new ObjectId(postId) });
    if (!post) {
      return res.status(404).json({ success: false, message: "Post non trovato" });
    }

    // Togli il like solo se esiste
    const result = await posts.updateOne(
      { _id: new ObjectId(postId) },
      { $pull: { likes: new ObjectId(mioId) } }
    );

    // Se è stato realmente tolto il like, togli 100 punti all'autore
    if (result.modifiedCount > 0) {
      await users.updateOne(
        { _id: new ObjectId(post.userId) },
        { $inc: { punti: -100 } }
      );
    }

    res.json({ success: true, message: "Like rimosso con successo" });
  } catch (err) {
    console.error("Errore nel togliere il like:", err);
    res.status(401).json({ success: false, message: "Token non valido o errore interno" });
  }
});


