import express from "express";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json());


app.listen(8080, () => console.log("Server avviato su porta 8080"));

app.get('/news', async (req, res) => {
  try {
    const utenti = await GetUtentiConsigliati(db);
    res.json(utenti);
  } catch (error) {
    console.error('Errore nella GET /utenti-consigliati:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});