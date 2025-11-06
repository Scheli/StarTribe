import { MongoClient } from "mongodb";

const uri = process.env.MONGODB_URI;
const client = new MongoClient(uri);

let db;

export async function connectToDB() {
  if (!db) {
    try {
      await client.connect();
      db = client.db("StarTribeDB");
      console.log("✅ Connessione a MongoDB riuscita");
    } catch (err) {
      console.error("❌ Errore nella connessione a MongoDB:", err);
      throw err;
    }
  }
  return db;
}

export async function aggiungiUtente(utente) {
  const db = await connectToDB();
  const utenti = db.collection("utenti");

  const utenteEsistente = await utenti.findOne({ email: utente.email });
  if (utenteEsistente) return null;

  const result = await utenti.insertOne(utente);
  return result.insertedId;
}

export async function GetUtentiConsigliati(dbInstance) {
  const db = dbInstance || (await connectToDB());
  const utenti = await db
    .collection("utenti")
    .aggregate([{ $sample: { size: 5 } }])
    .toArray();
  return utenti;
}
