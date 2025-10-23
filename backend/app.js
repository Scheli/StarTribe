  import "dotenv/config";
  import express from "express";
  import cors from "cors";
  import { connectToDB, aggiungiUtente, GetUtentiConsigliati } from "./db.js";
  import { getAPOD, getInSightWeather, getMarsRoverPhoto, searchImageLibrary } from "./apirequest.js";
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
  console.log(`[cards] trovate ${CARD_FILES.length} carte in ${CARDS_DIR}`);
} catch (err) {
  console.error("[cards] impossibile leggere la cartella:", err);
}

// Helper per pescare una carta random (ritorna la URL da usare nel frontend)
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


// ---------------- sicurezza e utente ----------------

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

  // ---------------- trofei ----------------

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

  // ---------------- seguire ----------------

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

  // ---------------- profilo ----------------

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
          tickets: utente.tickets || 0,
          cards: utente.cards || [],

        }
      });
    } catch (err) {
      console.error("Errore profilo:", err);
      return res.status(401).json({ success: false, message: "Token non valido o scaduto" });
    }
  });


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

  // ---------------- caricare ----------------

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

  app.get("/news/getMarsRoverPhoto", async (req, res) => {
    try {
      const photos = await getMarsRoverPhoto();
      res.json(photos);
    } catch (error) {
      console.log("Errore nella GET di photos: ", error);
      res.status(500).json({ error: error.message, stack: error.stack });
    }
  });

  app.get("/news/searchImageLibrary", async (req, res) => {
    try {
      const image = await searchImageLibrary();
      res.json(image);
    } catch (error) {
      console.log("Errore nella GET di image: ", error);
      res.status(500).json({ error: error.message, stack: error.stack });
    }
  });

  app.get("/news/all", async (req, res) => {
    try {
      const [apod, weather, imageLibrary] = await Promise.all([
        getAPOD(),
        getInSightWeather(),
        searchImageLibrary(),
      ]);

      res.json({ apod, weather, imageLibrary });
    } catch (error) {
      console.error("Errore nella GET /news/all:", error);
      res.status(500).json({ error: error.message, stack: error.stack });
    }
  });

  // ---------------- altro profilo ----------------

 app.get("/api/utente/:id", async (req, res) => {
  const id = req.params.id;

  try {
    const db = await connectToDB();
    const utente = await db.collection("utenti").findOne({ _id: new ObjectId(id) });

    if (!utente) {
      return res.status(404).json({ success: false, message: "Utente non trovato" });
    }

    res.json({
      success: true,
      utente: {
        username: utente.username,
        punti: utente.punti,
        immagineProfilo: utente.immagineProfilo,
        bannerProfilo: utente.bannerProfilo || null,
        selectedBorder: utente.selectedBorder || "none", 
      },
    });
  } catch (err) {
    console.error("Errore:", err);
    res.status(500).json({ success: false, message: "Errore del server" });
  }
});


app.use(express.json());

// rotta con multer (upload singolo file)
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

    const { titolo, descrizione } = req.body; // multer processa i campi testo e serve per gestire upload di file inviati tramite form, quando invii un form come file il browser non lo invia come json ma come un pacchetto speciale, quindi express non lo sa interpretare.
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
    const collection = db.collection("articoli");

    // Recupera tutti i post
    const posts = await collection.find({}).toArray();

    // Formatta la data e altri campi
    const postsFormatted = posts.map(post => ({
      titolo: post.titolo,
      descrizione: post.descrizione,
      ImmaginePost: post.ImmaginePost,
      TipoImmaginePost: post.TipoImmaginePost,
      UserId: post.UserId,
      createdAt: post.createdAt ? new Date(post.createdAt).toLocaleDateString('it-IT') : null
    }));

    res.json(postsFormatted);

  } catch (err) {
    console.error("Errore:", err);
    res.status(500).json({ success: false, message: "Errore del server" });
  }
});

// ---------------- operazioni shop e ticket ----------------
app.post("/api/tickets/use", async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ success: false, message: "Token mancante" });

  try {
    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, JWT_SECRET);

    const cardUrl = pickRandomCard();
    if (!cardUrl) {
      return res.status(500).json({ success: false, message: "Nessuna carta disponibile sul server" });
    }

    const db = await connectToDB();
    const utenti = db.collection("utenti");

    const r = await utenti.findOneAndUpdate(
      { _id: new ObjectId(decoded.userId), tickets: { $gt: 0 } },
      { $inc: { tickets: -1 }, $addToSet: { cards: cardUrl } },
      { returnDocument: "after" }
    );

    if (!r.value) {
      const exists = await utenti.findOne({ _id: new ObjectId(decoded.userId) });
      if (!exists) {
        return res.status(404).json({ success: false, message: "Utente non trovato" });
      }
      return res.status(403).json({
        success: false,
        message: "Nessun ticket disponibile",
        tickets: exists.tickets || 0
      });
    }

    return res.json({
      success: true,
      message: "Ticket utilizzato, carta ottenuta",
      tickets: r.value.tickets || 0,
      card: cardUrl
    });
  } catch (err) {
    console.error("POST /api/tickets/use", err);
    return res.status(401).json({ success: false, message: "Token non valido o scaduto" });
  }
});
