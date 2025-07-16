import express from "express";
import cors from "cors";
import { connectToDB, aggiungiUtente, GetUtentiConsigliati} from "./db.js";
import { getAPOD, getInSightWeather, getMarsRoverPhoto, searchImageLibrary} from "./apirequest.js";
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

app.listen(8080, async () => {
  try {
    db = await connectToDB();
    console.log("✅ Server avviato su http://localhost:8080 e connesso al DB");
  } catch (e) {
    console.error("❌ Errore durante la connessione al DB:", e);
  }
});


app.get('/news', async (req, res) => {
  try {
    const utenti = await GetUtentiConsigliati(db);
    res.json(utenti);
  } catch (error) {
    console.error('Errore nella GET /utenti-consigliati:', error);
    res.status(500).json({ error: error.message, stack: error.stack });
  }
});


app.get('/news/apod', async (req, res) => {
  try {
    const PictureDay = await getAPOD();
    res.json(PictureDay);
  } catch (error) {
    console.error('Errore nella GET di APOD: ', error);
    res.status(500).json({ error: error.message, stack: error.stack });
  }
});

app.get('/news/getInSightWeather', async (req, res) => {
  try{
    const Weather = await getInSightWeather();
    res.json(Weather);
  } catch (error){
    console.log('Errore nella GET di Weather: ', error);
    res.status(500).json({ error: error.message, stack: error.stack });
  }
});

app.get('/news/getMarsRoverPhoto', async (req, res) => {
  try{
    const photos = await getMarsRoverPhoto();
    res.json(photos);
  }catch(error){
    console.log('Errore nella GET di photos: ', error);
    res.status(500).json({ error: error.message, stack: error.stack });
  }
});

app.get('/news/searchImageLibrary', async (req, res) =>{
  try{
    const image = await searchImageLibrary();
    res.json(image);
  }catch(error){
    console.log('Errore nella GET di image: ', error);
    res.status(500).json({ error: error.message, stack: error.stack });
  }
});



app.get('/news/all', async (req, res) => {
  try {
    const [apod, weather, roverPhoto, imageLibrary] = await Promise.all([
      getAPOD(),
      getInSightWeather(),
      getMarsRoverPhoto(),
      searchImageLibrary()
    ]);

    res.json({
      apod,
      weather,
      roverPhoto,
      imageLibrary
    });
  } catch (error) {
    console.error('Errore nella GET /news/all:', error);
    res.status(500).json({ error: error.message, stack: error.stack });
  }
});
